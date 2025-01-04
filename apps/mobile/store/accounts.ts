import { Descriptor, Wallet } from 'bdk-rn'
import { Network } from 'bdk-rn/lib/lib/enums'
import { produce } from 'immer'
import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

import { getWalletData, getWalletFromDescriptor, syncWallet } from '@/api/bdk'
import { MempoolOracle } from '@/api/blockchain'
import { getBlockchainConfig } from '@/config/servers'
import mmkvStorage from '@/storage/mmkv'
import { type Account } from '@/types/models/Account'
import { TxOut } from '@/types/models/Blockchain'
import { Transaction } from '@/types/models/Transaction'
import { Utxo } from '@/types/models/Utxo'

import { useBlockchainStore } from './blockchain'

type AccountsState = {
  accounts: Account[]
  tags: string[]
}

type AccountsAction = {
  getCurrentAccount: (name: string) => Account | undefined
  hasAccountWithName: (name: string) => boolean
  loadWalletFromDescriptor: (
    externalDescriptor: Descriptor,
    internalDescriptor: Descriptor
  ) => Promise<Wallet>
  syncWallet: (wallet: Wallet, account: Account) => Promise<Account>
  addAccount: (account: Account) => Promise<void>
  updateAccount: (account: Account) => Promise<void>
  deleteAccounts: () => void
  getTags: () => string[]
  setTags: (tags: string[]) => void
  getTx: (accountName: string, txid: string) => Promise<Transaction>
  getUtxo: (accountName: string, txid: string, vout: number) => Promise<Utxo>
  // setTxLabel: (
  //   accountName: string,
  //   txid: string,
  //   vout: number,
  //   label: string
  // ) => Promise<Utxo>
  setUtxoLabel: (
    accountName: string,
    txid: string,
    vout: number,
    label: string
  ) => Promise<void>
}

const useAccountsStore = create<AccountsState & AccountsAction>()(
  persist(
    (set, get) => ({
      accounts: [],
      tags: [],
      getTags: () => {
        return get().tags
      },
      setTags: (tags: string[]) => {
        set({ tags })
      },
      getTx: async (accountName: string, txid: string) => {
        const account = get().getCurrentAccount(accountName) as Account

        let transaction = account.transactions.find((tx) => tx.id === txid)

        if (transaction !== null) {
          return transaction as Transaction
        }

        // TODO: replace MempoolOracle with BDK for enhanced privacy
        const { url } = useBlockchainStore.getState()
        const oracle = new MempoolOracle(url)
        const data = await oracle.getTransaction(txid)

        transaction = {
          id: data.txid,
          type: 'receive', // TODO: how to figure it out?
          sent: 0,
          received: 0,
          timestamp: new Date(data.status.block_time),
          size: data.size,
          vout: data.vout.map((out: TxOut) => ({
            value: out.value,
            address: out.scriptpubkey_address as string
          }))
        }

        account.transactions.push(transaction)
        get().updateAccount(account)

        return transaction
      },
      getUtxo: async (accountName: string, txid: string, vout: number) => {
        const account = get().getCurrentAccount(accountName) as Account

        let utxo = account.utxos.find((u) => {
          return u.txid === txid && u.vout === vout
        })

        if (utxo !== undefined && utxo !== null) {
          return utxo
        }

        const tx = await get().getTx(accountName, txid)

        utxo = {
          txid,
          vout,
          value: tx.vout[vout].value,
          timestamp: tx.timestamp,
          addressTo: tx.vout[vout].address,
          keychain: 'external' // TODO: is it right?
        }

        account.utxos.push(utxo)
        get().updateAccount(account)

        return utxo
      },
      setUtxoLabel: async (accountName, txid, vout, label) => {
        const account = get().getCurrentAccount(accountName) as Account

        let utxoIndex = account.utxos.findIndex((u) => {
          return u.txid === txid && u.vout === vout
        })

        if (utxoIndex === -1) {
          await get().getUtxo(accountName, txid, vout)
          utxoIndex = account.utxos.length
        }

        set(
          produce((state) => {
            const index = state.accounts.findIndex(
              (account) => account.name === accountName
            )
            state.accounts[index].utxos[utxoIndex].label = label
          })
        )
      },
      getCurrentAccount: (name) => {
        return get().accounts.find((account) => account.name === name)
      },
      hasAccountWithName: (name) => {
        return !!get().accounts.find((account) => account.name === name)
      },
      loadWalletFromDescriptor: async (
        externalDescriptor,
        internalDescriptor
      ) => {
        const { network } = useBlockchainStore.getState()

        const wallet = getWalletFromDescriptor(
          externalDescriptor,
          internalDescriptor,
          network as Network
        )
        return wallet
      },
      syncWallet: async (wallet, account) => {
        const { backend, network, retries, stopGap, timeout, url } =
          useBlockchainStore.getState()
        const opts = { retries, stopGap, timeout }

        await syncWallet(
          wallet,
          backend,
          getBlockchainConfig(backend, url, opts)
        )

        const { transactions, utxos, summary } = await getWalletData(
          wallet,
          network as Network
        )

        return { ...account, transactions, utxos, summary }
      },
      addAccount: async (account) => {
        set(
          produce((state: AccountsState) => {
            state.accounts.push(account)
          })
        )
      },
      updateAccount: async (account) => {
        set(
          produce((state: AccountsState) => {
            const index = state.accounts.findIndex(
              (_account) => _account.name === account.name
            )
            if (index !== -1) state.accounts[index] = account
          })
        )
      },
      deleteAccounts: () => {
        set(() => ({ accounts: [] }))
      }
    }),
    {
      name: 'satsigner-accounts',
      storage: createJSONStorage(() => mmkvStorage)
    }
  )
)

export { useAccountsStore }
