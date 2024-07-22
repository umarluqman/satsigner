import { useHeaderHeight } from '@react-navigation/elements'
import { Canvas, Group, useFonts } from '@shopify/react-native-skia'
import { hierarchy, HierarchyCircularNode, pack } from 'd3'
import { Image } from 'expo-image'
import { LinearGradient } from 'expo-linear-gradient'
import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { memo, useCallback, useEffect, useMemo, useState } from 'react'
import {
  GestureResponderEvent,
  Platform,
  StyleSheet,
  useWindowDimensions,
  View
} from 'react-native'
import {
  GestureDetector,
  GestureHandlerRootView
} from 'react-native-gesture-handler'
import Animated from 'react-native-reanimated'

import SSButton from '@/components/SSButton'
import SSIconButton from '@/components/SSIconButton'
import SSText from '@/components/SSText'
import UtxoFlow from '@/components/SSUtxoFlow'
import { useGestures } from '@/hooks/useGestures'
import { useLayout } from '@/hooks/useLayout'
import SSHStack from '@/layouts/SSHStack'
import SSVStack from '@/layouts/SSVStack'
import { i18n } from '@/locales'
import { useAccountStore } from '@/store/accounts'
import { useBlockchainStore } from '@/store/blockchain'
import { usePriceStore } from '@/store/price'
import { useTransactionBuilderStore } from '@/store/transactionBuilder'
import { Colors, Layout } from '@/styles'
import { type Utxo } from '@/types/models/Utxo'
import { type AccountSearchParams } from '@/types/navigation/searchParams'
import { formatAddress, formatNumber } from '@/utils/format'

type UtxoListBubble = Partial<Utxo> & {
  id: string
  value: number
  children: UtxoListBubble[]
}

export default memo(UTXOTransactionFlow)

function UTXOTransactionFlow() {
  const router = useRouter()
  const accountStore = useAccountStore()
  const transactionBuilderStore = useTransactionBuilderStore()
  const priceStore = usePriceStore()
  // const blockchainStore = useBlockchainStore()
  const account = useAccountStore()

  const { id } = useLocalSearchParams<AccountSearchParams>()

  const topHeaderHeight = useHeaderHeight()
  const { width, height } = useWindowDimensions()

  const hasSelectedUtxos = transactionBuilderStore.inputs.size > 0

  const utxosValue = useCallback(
    (utxos: Utxo[]): number => utxos.reduce((acc, utxo) => acc + utxo.value, 0),
    []
  )

  const utxosTotalValue = useMemo(
    () => utxosValue(accountStore.currentAccount.utxos),
    [accountStore.currentAccount.utxos, utxosValue]
  )
  const utxosSelectedValue = useMemo(() => {
    return utxosValue(transactionBuilderStore.getInputs())
  }, [transactionBuilderStore, utxosValue])

  // Add this to log the transaction details of selected inputs
  const selectedInputDetails = transactionBuilderStore.getInputDetails()
  // console.log('Selected input transaction details:', selectedInputDetails)

  const GRAPH_HEIGHT = height - topHeaderHeight + 20
  const GRAPH_WIDTH = width

  const canvasSize = { width: GRAPH_WIDTH, height: GRAPH_HEIGHT }

  const centerX = canvasSize.width / 2
  const centerY = canvasSize.height / 2

  const outputs = transactionBuilderStore.getOutputs()
  const inputs = transactionBuilderStore.getInputs()
  const [transactionFlow, setTransactionFlow] = useState<{
    inputs: Utxo[]
    outputs: { type: string; value: number }[]
    totalValue: number
    vSize: number
  } | null>(null)

  useEffect(() => {
    const fetchTransactionFlow = async () => {
      try {
        const flow = await transactionBuilderStore.getTransactionFlow()
        setTransactionFlow(flow)

        // // Store the outputs in the transactionBuilderStore
        // flow.outputs.forEach((output) => {
        //   transactionBuilderStore.addOutput(output.type, output.value)
        // })
      } catch (error) {
        console.error('Error fetching transaction flow:', error)
      }
    }

    fetchTransactionFlow()
  }, [])

  const sankeyWidth = canvasSize.width
  const sankeyHeight = canvasSize.height - 200

  // console.log({ OUT: transactionFlow?.outputs })
  // console.log({ IN: transactionFlow?.inputs })
  console.log({ yyy: account.currentAccount.address })

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <Stack.Screen
        options={{
          headerTitle: () => (
            <SSText uppercase>{accountStore.currentAccount.name}</SSText>
          )
        }}
      />
      <LinearGradient
        style={styles.absoluteTopContainer}
        locations={[0.185, 0.5554, 0.7713, 1]}
        colors={['#000000F5', '#000000A6', '#0000004B', '#00000000']}
      >
        <SSVStack>
          <SSHStack justifyBetween>
            <SSText color="muted">Group</SSText>
            <SSText size="md">
              {i18n.t('signAndSend.selectSpendableOutputs')}
            </SSText>
            <SSIconButton
              onPress={() =>
                router.navigate(`/account/${id}/signAndSend/selectUtxoList`)
              }
            >
              <Image
                style={{ width: 24, height: 16 }}
                source={require('@/assets/icons/list.svg')}
              />
            </SSIconButton>
          </SSHStack>
          <SSVStack itemsCenter gap="sm">
            <SSVStack itemsCenter gap="xs">
              <SSText>
                {transactionBuilderStore.inputs.size}{' '}
                {i18n.t('common.of').toLowerCase()}{' '}
                {accountStore.currentAccount.utxos.length}{' '}
                {i18n.t('common.selected').toLowerCase()}
              </SSText>
              <SSHStack gap="xs">
                <SSText size="xxs" style={{ color: Colors.gray[400] }}>
                  {i18n.t('common.total')}
                </SSText>
                <SSText size="xxs" style={{ color: Colors.gray[75] }}>
                  {formatNumber(utxosTotalValue)}
                </SSText>
                <SSText size="xxs" style={{ color: Colors.gray[400] }}>
                  {i18n.t('bitcoin.sats').toLowerCase()}
                </SSText>
                <SSText size="xxs" style={{ color: Colors.gray[75] }}>
                  {formatNumber(priceStore.satsToFiat(utxosTotalValue), 2)}
                </SSText>
                <SSText size="xxs" style={{ color: Colors.gray[400] }}>
                  {priceStore.fiatCurrency}
                </SSText>
              </SSHStack>
            </SSVStack>
            <SSVStack itemsCenter gap="none">
              <SSHStack gap="xs" style={{ alignItems: 'baseline' }}>
                <SSText
                  size="7xl"
                  color="white"
                  weight="ultralight"
                  style={{ lineHeight: 62 }}
                >
                  {formatNumber(utxosSelectedValue)}
                </SSText>
                <SSText size="xl" color="muted">
                  {i18n.t('bitcoin.sats').toLowerCase()}
                </SSText>
              </SSHStack>
              <SSHStack gap="xs" style={{ alignItems: 'baseline' }}>
                <SSText size="md" color="muted">
                  {formatNumber(priceStore.satsToFiat(utxosSelectedValue), 2)}
                </SSText>
                <SSText size="xs" style={{ color: Colors.gray[500] }}>
                  {priceStore.fiatCurrency}
                </SSText>
              </SSHStack>
            </SSVStack>
          </SSVStack>
        </SSVStack>
      </LinearGradient>
      <View style={{ position: 'absolute', top: 100 }}>
        {(transactionFlow?.inputs?.length ?? 0) > 0 &&
        (transactionFlow?.outputs?.length ?? 0) > 0 ? (
          <UtxoFlow
            inputs={transactionFlow?.inputs}
            outputs={transactionFlow?.outputs}
            width={sankeyWidth}
            height={sankeyHeight}
            centerX={centerX}
            centerY={centerY}
            vSize={transactionFlow?.vSize ?? 0}
            walletAddress={formatAddress(account.currentAccount.address ?? '')}
            // walletAddress={account.currentAccount.address ?? ''}
          />
        ) : null}

        <View
          style={{
            flex: 1,
            position: 'absolute',
            top: 0,
            right: 0,
            bottom: 0,
            left: 0
          }}
        >
          <Animated.View></Animated.View>
        </View>
      </View>
      <LinearGradient
        locations={[0, 0.1255, 0.2678, 1]}
        style={[styles.absoluteSubmitContainer]}
        colors={['#00000000', '#0000000F', '#0000002A', '#000000']}
      >
        <SSVStack style={{ width: '92%' }}>
          <SSButton
            label={i18n.t('signAndSend.addAsInputToMessage')}
            variant="secondary"
            disabled={!hasSelectedUtxos}
            style={[
              { opacity: 100 },
              !hasSelectedUtxos && {
                backgroundColor: Colors.gray[700]
              }
            ]}
            textStyle={[!hasSelectedUtxos && { color: Colors.gray[400] }]}
          />
        </SSVStack>
      </LinearGradient>
    </GestureHandlerRootView>
  )
}

const styles = StyleSheet.create({
  absoluteTopContainer: {
    width: '100%',
    position: 'absolute',
    paddingHorizontal: Layout.mainContainer.paddingHorizontal,
    paddingTop: Layout.mainContainer.paddingTop,
    zIndex: 20
  },
  absoluteSubmitContainer: {
    position: 'absolute',
    bottom: 0,
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'center',
    backgroundColor: Colors.transparent,
    paddingHorizontal: 0,
    paddingTop: 0,
    paddingBottom: 20
  }
})
