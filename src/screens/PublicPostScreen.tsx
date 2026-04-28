import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function PublicPostScreen({ navigation, route }: any) {
  const token = route?.params?.token;
  const postId = route?.params?.id;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.content}>
        <Text style={styles.title}>Public post preview</Text>
        <Text style={styles.body}>
          {token
            ? `Opened from token: ${token}`
            : postId
              ? `Opened post id: ${postId}`
              : 'Open this post in app feed to view full details.'}
        </Text>
        <TouchableOpacity style={styles.button} onPress={() => navigation.replace('MainTabs', { screen: 'Home' })}>
          <Text style={styles.buttonText}>Go to Feed</Text>
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
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '800',
    textAlign: 'center',
  },
  body: {
    marginTop: 12,
    color: '#9CA3AF',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  button: {
    marginTop: 22,
    borderRadius: 10,
    backgroundColor: '#8B5CF6',
    paddingHorizontal: 22,
    paddingVertical: 12,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
});
