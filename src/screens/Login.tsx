import React, { useState } from 'react';
import {
    View,
    Text,
    TextInput,
    StyleSheet,
    SafeAreaView,
    Pressable,
    KeyboardAvoidingView,
    Platform,
} from 'react-native';
import { ALERT_TYPE, AlertNotificationRoot, Toast } from 'react-native-alert-notification';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../App';
import AsyncStorage from '@react-native-async-storage/async-storage';

type Props = NativeStackScreenProps<RootStackParamList, 'Login'>;

const BACKEND_URL = "https://9f1e1b68ac76.ngrok-free.app";

export default function LoginPage({ navigation }: Props) {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const navigateToRegistration = () => {
        navigation.navigate('Registration');
    };
    
    const handleLogin = async () => {

        if (!email.trim() || !password.trim()) {
            Toast.show({
                type: ALERT_TYPE.DANGER,
                title: 'Error',
                textBody: 'Please fill in all fields',
            });
            return;
        }


        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            Toast.show({
                type: ALERT_TYPE.DANGER,
                title: 'Error',
                textBody: 'Please enter a valid email',
            });
            return;
        }

        setIsLoading(true);

        try {

            const response = await fetch(BACKEND_URL + "/ExpenseTracker/Login", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    email: email.trim(),
                    password: password,
                }),
            });



            if (response.ok) {

                const result = await response.json();

                if (result.status) {
                    console.log('Login result:', result);

                    const userId = result.logUser.id;
                    const userName = result.logUser.full_name;

                    await AsyncStorage.setItem('@loggedUser', JSON.stringify(result.logUser));

                    navigation.reset({
                        index: 0,
                        routes: [
                            {
                                name: 'Home',
                                params: {
                                    user: {
                                        id: userId,
                                        name: userName,
                                    },
                                },

                            },
                        ],
                    });
                } else {
                    Toast.show({
                        type: ALERT_TYPE.DANGER,
                        title: 'Login Failed',
                        textBody: 'Somthing went wrong',
                    });
                }

            } else {

                Toast.show({
                    type: ALERT_TYPE.DANGER,
                    title: 'Login Failed',
                    textBody: 'Invalid email or password',
                });
            }
        } catch (error) {

            Toast.show({
                type: ALERT_TYPE.DANGER,
                title: 'Connection Error',
                textBody: 'Could not connect to server',
            });
        } finally {
            setIsLoading(false);
        }
    };
//view
    return (
        <SafeAreaView style={styles.container}>
            <AlertNotificationRoot>


                <View style={styles.header}>
                    <Text style={styles.headerTitle}>Welcome Back</Text>
                    <Text style={styles.headerSubtitle}>Sign in to your account</Text>
                </View>


                <View style={styles.formContainer}>
                    <Text style={styles.sectionTitle}>Login</Text>

                    <View style={styles.inputContainer}>
                        <Text style={styles.inputLabel}>Email</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="Enter your email"
                            placeholderTextColor="#9ca3af"
                            value={email}
                            onChangeText={setEmail}
                            keyboardType="email-address"
                            autoCapitalize="none"
                            autoCorrect={false}
                        />
                    </View>

                    <View style={styles.inputContainer}>
                        <Text style={styles.inputLabel}>Password</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="Enter your password"
                            placeholderTextColor="#9ca3af"
                            value={password}
                            onChangeText={setPassword}
                            secureTextEntry={true}
                            autoCapitalize="none"
                        />
                    </View>

                    <Pressable
                        style={[styles.loginButton, isLoading && styles.loginButtonDisabled]}
                        onPress={handleLogin}
                        disabled={isLoading}
                    >
                        <Text style={styles.loginButtonText}>
                            {isLoading ? 'Signing In...' : 'Sign In'}
                        </Text>
                    </Pressable>


                </View>

                {/* Footer */}
                <View style={styles.footer}>
                    <Text style={styles.footerText}>Don't have an account?</Text>
                    <Pressable onPress={navigateToRegistration}>
                        <Text style={styles.signUpText}> Sign Up</Text>
                    </Pressable>
                </View>

            </AlertNotificationRoot>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f8fafc',
    },
    header: {
        backgroundColor: '#6366f1',
        paddingTop: 60,
        paddingBottom: 40,
        paddingHorizontal: 20,
        borderBottomLeftRadius: 25,
        borderBottomRightRadius: 25,
        alignItems: 'center',
    },
    headerTitle: {
        fontSize: 32,
        fontWeight: 'bold',
        color: 'white',
        marginBottom: 8,
    },
    headerSubtitle: {
        fontSize: 16,
        color: 'rgba(255, 255, 255, 0.8)',
    },
    formContainer: {
        backgroundColor: 'white',
        margin: 20,
        marginTop: 40,
        padding: 30,
        borderRadius: 20,
        elevation: 3,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
    },
    sectionTitle: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#374151',
        marginBottom: 30,
        textAlign: 'center',
    },
    inputContainer: {
        marginBottom: 20,
    },
    inputLabel: {
        fontSize: 16,
        fontWeight: '600',
        color: '#374151',
        marginBottom: 8,
    },
    input: {
        backgroundColor: '#f3f4f6',
        borderRadius: 12,
        padding: 15,
        fontSize: 16,
        color: '#374151',
        borderWidth: 1,
        borderColor: '#e5e7eb',
    },
    loginButton: {
        backgroundColor: '#6366f1',
        borderRadius: 12,
        padding: 16,
        alignItems: 'center',
        marginTop: 10,
    },
    loginButtonDisabled: {
        backgroundColor: '#9ca3af',
    },
    loginButtonText: {
        color: 'white',
        fontSize: 18,
        fontWeight: 'bold',
    },
    forgotPasswordContainer: {
        alignItems: 'center',
        marginTop: 20,
    },
    forgotPasswordText: {
        color: '#6366f1',
        fontSize: 14,
        fontWeight: '500',
    },
    footer: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingBottom: 40,
        marginTop: 'auto',
    },
    footerText: {
        color: '#6b7280',
        fontSize: 14,
    },
    signUpText: {
        color: '#6366f1',
        fontSize: 14,
        fontWeight: 'bold',
    },
});