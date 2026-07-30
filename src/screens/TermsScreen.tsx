import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import GazetteerScreenShell from '../components/GazetteerScreenShell.native';
import { gazetteerHeader } from '../theme/gazetteerAmbientNative';
import { ox } from '../constants/nativeOpticalScale';

export default function TermsScreen({ navigation }: any) {
  return (
    <GazetteerScreenShell>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Icon name="arrow-back" size={ox(22)} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.title}>Terms</Text>
        <View style={styles.backBtn} />
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.sectionTitle}>Terms of Use</Text>
        <Text style={styles.body}>
          By using Clips, you agree to share content responsibly, respect community guidelines, and avoid abusive behavior.
        </Text>
        <Text style={styles.sectionTitle}>Privacy</Text>
        <Text style={styles.body}>
          We process account and usage data to provide app features such as feed ranking, messaging, and notifications.
        </Text>
        <Text style={styles.sectionTitle}>Safety</Text>
        <Text style={styles.body}>
          You are responsible for content you publish. Report harmful content through in-app moderation options.
        </Text>
      </ScrollView>
    </GazetteerScreenShell>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: ox(16),
    paddingVertical: ox(12),
    ...gazetteerHeader,
  },
  backBtn: {
    width: ox(32),
    height: ox(32),
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    color: '#FFFFFF',
    fontSize: ox(18),
    fontWeight: '700',
  },
  content: {
    padding: ox(16),
  },
  sectionTitle: {
    color: '#FFFFFF',
    fontSize: ox(15),
    fontWeight: '700',
    marginTop: ox(10),
    marginBottom: ox(6),
  },
  body: {
    color: '#D1D5DB',
    fontSize: ox(13),
    lineHeight: ox(19),
  },
});
