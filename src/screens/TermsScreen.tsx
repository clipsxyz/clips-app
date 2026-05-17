import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import GazetteerScreenShell from '../components/GazetteerScreenShell.native';
import { gazetteerHeader } from '../theme/gazetteerAmbientNative';

export default function TermsScreen({ navigation }: any) {
  return (
    <GazetteerScreenShell>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Icon name="arrow-back" size={22} color="#FFFFFF" />
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
    paddingHorizontal: 16,
    paddingVertical: 12,
    ...gazetteerHeader,
  },
  backBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
  content: {
    padding: 16,
  },
  sectionTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
    marginTop: 10,
    marginBottom: 6,
  },
  body: {
    color: '#D1D5DB',
    fontSize: 13,
    lineHeight: 19,
  },
});
