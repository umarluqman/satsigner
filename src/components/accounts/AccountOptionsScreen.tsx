import React from 'react';
import {
  View,
  StyleSheet,
  Modal
} from 'react-native';
import { NavigationProp } from '@react-navigation/native';

import { Layout, Colors } from '../../styles';
import navUtils from '../../utils/NavUtils';

import notImplementedAlert from '../shared/notImplementedAlert';

import Button from '../shared/Button';
import SelectButton from '../shared/SelectButton';
import { AppText } from '../shared/AppText';

import ScriptVersionModal from './ScriptVersionModal';
import { ScriptVersion } from '../../enums/ScriptVersion';
import { ScriptVersionInfos } from './ScriptVersionInfos';

import { AccountsContext } from './AccountsContext';

import SeedWordsModal from './SeedWordsModal';
import { SeedWords } from '../../enums/SeedWords';
import { SeedWordsInfos } from './SeedWordsInfos';
import { AccountCreationType } from '../../enums/AccountCreationType';

interface Props {
  navigation: NavigationProp<any>
}

interface State {
  scriptVersion: ScriptVersion,
  scriptVersionName: string,
  scriptVersionModalVisible: boolean,

  seedWords: SeedWords,
  seedWordsName: string,
  seedWordsModalVisible: boolean,
}

export default class AccountOptionsScreen extends React.PureComponent<Props, State> {
  static contextType = AccountsContext;
  
  constructor(props: any) {
    super(props);

    this.state = {
      scriptVersion: ScriptVersion.P2WPKH,
      scriptVersionName: ScriptVersionInfos.getName(ScriptVersion.P2WPKH),
      scriptVersionModalVisible: false,

      seedWords: SeedWords.WORDS24,
      seedWordsName: SeedWordsInfos.getName(SeedWords.WORDS24),
      seedWordsModalVisible: false
    };
  }

  componentDidMount() {
    navUtils.setHeaderTitle(this.context.currentAccount.name, this.props.navigation);
  }

  componentDidUpdate() {
    navUtils.setHeaderTitle(this.context.currentAccount.name, this.props.navigation);
  }

  render() {
    const {
      scriptVersion,
      scriptVersionName,
      scriptVersionModalVisible,
      seedWords,
      seedWordsName,
      seedWordsModalVisible
    } = this.state;
    
    return (
      <AccountsContext.Consumer>
        {({currentAccount, setCurrentAccount}) => (
          <View style={styles.container}>
            <View style={styles.options}>
              <View style={styles.option}>
                <AppText style={styles.label}>
                  Policy Type
                </AppText>
                <SelectButton
                  style={styles.disabledSelectButton}
                  title="Single Signature"
                  onPress={notImplementedAlert}
                >
                </SelectButton>
              </View>
              <View style={styles.option}>
                <AppText style={styles.label}>
                  Script Version
                </AppText>
                <SelectButton
                  title={scriptVersionName}
                  onPress={() => this.setState({scriptVersionModalVisible: true})}
                >
                </SelectButton>
              </View>
              <View style={styles.option}>
                <AppText style={styles.label}>
                  Mnemonic Seed Words (BIP39)
                </AppText>
                <SelectButton
                  title={seedWordsName}
                  onPress={() => this.setState({seedWordsModalVisible: true})}
                >
                </SelectButton>
              </View>
            </View>
            <View style={styles.actions}>
              <Button
                title={this.getSubmitActionTitle()}
                onPress={() => this.submit()}
                style={styles.defaultActionButton}
              ></Button>
              <Button
                title='Cancel'
                onPress={() => this.cancel()}
                style={styles.cancelActionButton}
              ></Button>
            </View>
            <Modal
              visible={scriptVersionModalVisible}
              transparent={false}
            >
              <ScriptVersionModal
                onClose={(scriptVersion: ScriptVersion) => this.setScriptVersion(scriptVersion)}
                scriptVersion={scriptVersion}
              ></ScriptVersionModal>
            </Modal>
            <Modal
              visible={seedWordsModalVisible}
              transparent={false}
            >
              <SeedWordsModal
                onClose={(seedWords: SeedWords) => this.setSeedWords(seedWords)}
                seedWords={seedWords}
              ></SeedWordsModal>
            </Modal>
          </View>
        )}
      </AccountsContext.Consumer>
    );

  }

  private getSubmitActionTitle(): string {
    switch (this.context.currentAccount?.accountCreationType) {
      case AccountCreationType.Generate:
        return 'Generate New Seed';
      case AccountCreationType.Import:
        return 'Import Seed';
      default:
        return 'Go';
    }
  }

  private submit() {
    this.context.setCurrentAccount({
      ...this.context.currentAccount,
      scriptVersion: this.state.scriptVersion,
      seedWords: this.state.seedWords
    });

    switch (this.context.currentAccount?.accountCreationType) {
      case AccountCreationType.Generate:
        this.props.navigation.navigate('GenerateSeed');
        break;
      case AccountCreationType.Import:
        this.props.navigation.navigate('ImportSeed');
        break;
      default:
        notImplementedAlert();
    }
  }

  private cancel() {
    this.props.navigation.navigate('AccountList');
  }

  private setScriptVersion(scriptVersion: ScriptVersion | null) {
    if (scriptVersion) {
      const scriptVersionName = ScriptVersionInfos.getName(scriptVersion);
      this.setState({
        scriptVersion,
        scriptVersionName,
        scriptVersionModalVisible: false
      });
    } else {
      this.setState({scriptVersionModalVisible: false});
    }
  }

  private setSeedWords(seedWords: SeedWords | null) {
    if (seedWords) {
      const seedWordsName = SeedWordsInfos.getName(seedWords);
      this.setState({
        seedWords,
        seedWordsName,
        seedWordsModalVisible: false
      });
    } else {
      this.setState({seedWordsModalVisible: false});
    }
  }

}

const styles = StyleSheet.create({  
  container: {
    ...Layout.container.base,
    ...Layout.container.topPadded,
    ...Layout.container.horizontalPadded,
    justifyContent: 'space-between'
  },
  label: {
    alignSelf: 'center',
    marginBottom: 7,
  },
  defaultActionButton: {
    backgroundColor: Colors.defaultActionBackground,
    color: Colors.defaultActionText
  },
  cancelActionButton: {
    backgroundColor: Colors.cancelActionBackground,
    color: Colors.cancelActionText,
    marginBottom: 42
  },
  additionalActionButton: {
    backgroundColor: Colors.additionalActionBackground,
    color: Colors.additionalActionText,
    borderColor: Colors.additionalActionBorder
  },
  disabledAdditionalActionButton: {
    borderColor: Colors.additionalActionBorder,
    backgroundColor: Colors.additionalActionBackground,
    color: Colors.disabledActionText
  },
  disabledSelectButton: {
    color: Colors.disabledActionText
  },
  options: {
  },
  option: {
    marginBottom: 6
  },
  actions: {
    justifyContent: 'space-evenly',
    marginVertical: 2
  },
});
