/**
 * ProfileScreen — account management.
 *
 * Shows the signed-in user's email, lets them edit their display name, and
 * exposes sign-out and (destructive) delete-account actions. All state and the
 * data calls live in {@link useProfile}; this component is presentational.
 *
 * Sign-out and delete clear the Supabase session, so the navigator swaps back to
 * the auth stack on its own — no navigation calls here.
 *
 * Typed as `BottomTabScreenProps<MainTabParamList, 'Profile'>`.
 */
import React, { useCallback, useMemo } from 'react';
import {
  ActivityIndicator,
  Alert,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';

import { useTheme } from '../../theme';
import { useTranslation } from '../../i18n';
import type { MainTabParamList } from '../../navigation/types';
import { useProfile } from './useProfile';

export type ProfileScreenProps = BottomTabScreenProps<
  MainTabParamList,
  'Profile'
>;

export function ProfileScreen(_props: ProfileScreenProps): React.JSX.Element {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const {
    email,
    loading,
    error,
    displayName,
    setDisplayName,
    dirty,
    saving,
    save,
    deleting,
    deleteAccount,
    signOut
  } = useProfile();

  const inputStyle = useMemo(
    () => [
      styles.input,
      {
        backgroundColor: colors.neutral100,
        borderColor: colors.neutral500,
        color: colors.typography
      }
    ],
    [colors]
  );

  const confirmDelete = useCallback((): void => {
    Alert.alert(
      t('profile.delete.confirmTitle'),
      t('profile.delete.confirmBody'),
      [
        { text: t('profile.delete.cancel'), style: 'cancel' },
        {
          text: t('profile.delete.confirm'),
          style: 'destructive',
          onPress: () => {
            void deleteAccount();
          }
        }
      ]
    );
  }, [t, deleteAccount]);

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.neutral300 }]}>
      <View style={styles.header}>
        <Text style={[styles.heading, { color: colors.typography }]}>
          {t('profile.title')}
        </Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {loading ? (
          <ActivityIndicator color={colors.primary500} style={styles.loader} />
        ) : (
          <>
            {/* ---- Account ---- */}
            <Text style={[styles.sectionTitle, { color: colors.gray500 }]}>
              {t('profile.sections.account').toUpperCase()}
            </Text>
            <View
              style={[
                styles.card,
                { backgroundColor: colors.neutral100, borderColor: colors.neutral500 }
              ]}
            >
              <View style={[styles.row, { borderBottomColor: colors.neutral500 }]}>
                <Text style={[styles.rowLabel, { color: colors.typography }]}>
                  {t('profile.email')}
                </Text>
                <Text style={[styles.rowValue, { color: colors.gray300 }]}>
                  {email ?? '—'}
                </Text>
              </View>

              <View style={styles.fieldBlock}>
                <Text style={[styles.fieldLabel, { color: colors.gray500 }]}>
                  {t('profile.displayName')}
                </Text>
                <TextInput
                  style={inputStyle}
                  value={displayName}
                  onChangeText={setDisplayName}
                  placeholder={t('profile.displayNamePlaceholder')}
                  placeholderTextColor={colors.gray300}
                  autoCapitalize="words"
                  autoCorrect={false}
                  editable={!saving}
                  accessibilityLabel={t('profile.displayName')}
                />
                <TouchableOpacity
                  style={[
                    styles.saveButton,
                    {
                      backgroundColor: colors.primary500,
                      opacity: dirty && !saving ? 1 : 0.5
                    }
                  ]}
                  onPress={() => void save()}
                  disabled={!dirty || saving}
                  accessibilityRole="button"
                  accessibilityLabel={t('profile.save')}
                  accessibilityState={{ disabled: !dirty || saving, busy: saving }}
                >
                  {saving ? (
                    <ActivityIndicator color={colors.white} />
                  ) : (
                    <Text style={[styles.saveButtonText, { color: colors.white }]}>
                      {t('profile.save')}
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>

            {error ? (
              <Text
                style={[styles.error, { color: colors.error }]}
                accessibilityLiveRegion="polite"
              >
                {error}
              </Text>
            ) : null}

            {/* ---- Sign out ---- */}
            <TouchableOpacity
              style={[
                styles.actionButton,
                { borderColor: colors.neutral500, backgroundColor: colors.neutral100 }
              ]}
              onPress={() => void signOut()}
              accessibilityRole="button"
              accessibilityLabel={t('profile.signOut')}
            >
              <Text style={[styles.actionText, { color: colors.typography }]}>
                {t('profile.signOut')}
              </Text>
            </TouchableOpacity>

            {/* ---- Danger zone ---- */}
            <Text style={[styles.sectionTitle, styles.dangerTitle, { color: colors.gray500 }]}>
              {t('profile.sections.danger').toUpperCase()}
            </Text>
            <TouchableOpacity
              style={[styles.actionButton, { borderColor: colors.error }]}
              onPress={confirmDelete}
              disabled={deleting}
              accessibilityRole="button"
              accessibilityLabel={t('profile.delete.action')}
              accessibilityState={{ busy: deleting }}
            >
              {deleting ? (
                <ActivityIndicator color={colors.error} />
              ) : (
                <Text style={[styles.actionText, { color: colors.error }]}>
                  {t('profile.delete.action')}
                </Text>
              )}
            </TouchableOpacity>
            <Text style={[styles.dangerHint, { color: colors.gray300 }]}>
              {t('profile.delete.hint')}
            </Text>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12
  },
  heading: {
    fontSize: 28,
    fontWeight: '700'
  },
  scroll: {
    flex: 1
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 40
  },
  loader: {
    marginTop: 48
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
    marginBottom: 6,
    marginLeft: 4
  },
  dangerTitle: {
    marginTop: 28
  },
  card: {
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden'
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth
  },
  rowLabel: {
    fontSize: 15,
    flex: 1
  },
  rowValue: {
    fontSize: 15,
    flexShrink: 1,
    textAlign: 'right',
    marginLeft: 12
  },
  fieldBlock: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 16
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: 8
  },
  input: {
    height: 48,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 14,
    fontSize: 16,
    marginBottom: 12
  },
  saveButton: {
    height: 44,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center'
  },
  saveButtonText: {
    fontSize: 15,
    fontWeight: '700'
  },
  error: {
    fontSize: 14,
    marginTop: 12,
    marginHorizontal: 4
  },
  actionButton: {
    height: 50,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16
  },
  actionText: {
    fontSize: 16,
    fontWeight: '600'
  },
  dangerHint: {
    fontSize: 12,
    marginTop: 8,
    marginHorizontal: 4
  }
});

export default ProfileScreen;
