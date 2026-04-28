import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function ReplyQuestionScreen({ navigation }: any) {
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.content}>
        <Text style={styles.title}>Reply to Question</Text>
        <Text style={styles.body}>
          Question reply flow for native can continue from here. Use Create to compose your response.
        </Text>
        <TouchableOpacity style={styles.primary} onPress={() => navigation.navigate('CreateComposer')}>
          <Text style={styles.primaryText}>Open Create</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#030712',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  title: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '800',
  },
  body: {
    marginTop: 12,
    color: '#9CA3AF',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  primary: {
    marginTop: 22,
    borderRadius: 10,
    backgroundColor: '#8B5CF6',
    paddingHorizontal: 22,
    paddingVertical: 12,
  },
  primaryText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
});
