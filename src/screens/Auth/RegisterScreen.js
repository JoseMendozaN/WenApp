import React, { useState } from 'react';
import { 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  Image, 
  StyleSheet,
  Alert,
  ActivityIndicator,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Picker
} from 'react-native';
import { supabase } from '../../lib/supabase';

const { width, height } = Dimensions.get('window');
const isMobile = width < 768;
const isTablet = width >= 768 && width < 1024;
const isWeb = Platform.OS === 'web';

export default function RegisterScreen({ navigation }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nombreusuario, setNombreUsuario] = useState('');
  const [rol, setRol] = useState('invitado');
  const [loading, setLoading] = useState(false);
  const [isFocused, setIsFocused] = useState({
    email: false,
    password: false,
    nombreusuario: false
  });

  const rolesPermitidos = ['admin', 'maestro', 'directivo', 'invitado'];

  const handleRegister = async () => {
    setLoading(true);
    try {
      const { data: { user }, error } = await supabase.auth.signUp({ email, password });
      if (error) throw error;

      const { error: insertError } = await supabase
        .from('usuarios')
        .insert([{
          idusuario: user.id,
          nombreusuario,
          email: user.email,
          rol
        }]);

      if (insertError) throw insertError;

      const { data: usuario } = await supabase
        .from('usuarios')
        .select('rol')
        .eq('idusuario', user.id)
        .single();

      navigation.replace(usuario.rol === 'admin' ? 'principalAdmin' : 'solicitarPrestamoUsuario');
    } catch (error) {
      Alert.alert('Error de registro', error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleFocus = (field) => setIsFocused({...isFocused, [field]: true});
  const handleBlur = (field) => setIsFocused({...isFocused, [field]: false});

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <ScrollView 
        contentContainerStyle={styles.scrollContainer}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.card}>
          {/* Logo Institucional */}
          <View style={styles.logoContainer}>
            <Image
              source={{ uri: 'https://utregionaldelsur.sidci.mx/img/logo.png' }}
              style={styles.logo}
              resizeMode="contain"
            />
          </View>

          {/* Título */}
          <Text style={styles.title}>Sistema de Gestión de Equipos</Text>
          <Text style={styles.subtitle}>Registro de usuario</Text>

          {/* Formulario */}
          <View style={styles.form}>
            <Text style={styles.label}>Nombre de usuario</Text>
            <TextInput
              placeholder="Ingresa tu nombre de usuario"
              placeholderTextColor="#9CA3AF"
              value={nombreusuario}
              onChangeText={setNombreUsuario}
              style={[
                styles.input,
                isFocused.nombreusuario && styles.inputFocused
              ]}
              onFocus={() => handleFocus('nombreusuario')}
              onBlur={() => handleBlur('nombreusuario')}
            />

            <Text style={styles.label}>Correo electrónico</Text>
            <TextInput
              placeholder="usuario@dominio.com"
              placeholderTextColor="#9CA3AF"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              style={[
                styles.input,
                isFocused.email && styles.inputFocused
              ]}
              onFocus={() => handleFocus('email')}
              onBlur={() => handleBlur('email')}
            />

            <Text style={styles.label}>Contraseña</Text>
            <TextInput
              placeholder="••••••••"
              placeholderTextColor="#9CA3AF"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              style={[
                styles.input,
                isFocused.password && styles.inputFocused
              ]}
              onFocus={() => handleFocus('password')}
              onBlur={() => handleBlur('password')}
            />

            <Text style={styles.label}>Rol</Text>
            <View style={[
                styles.input,
                styles.pickerContainer
              ]}>
              <Picker
                selectedValue={rol}
                onValueChange={(itemValue) => setRol(itemValue)}
                style={styles.picker}
                dropdownIconColor="#6B7280"
              >
                {rolesPermitidos.map((rolItem) => (
                  <Picker.Item 
                    key={rolItem} 
                    label={rolItem.charAt(0).toUpperCase() + rolItem.slice(1)} 
                    value={rolItem} 
                  />
                ))}
              </Picker>
            </View>

            <TouchableOpacity
              style={styles.registerButton}
              onPress={handleRegister}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#FFF" size="small" />
              ) : (
                <Text style={styles.buttonText}>Registrarse</Text>
              )}
            </TouchableOpacity>
          </View>

          {/* Login */}
          <View style={styles.loginContainer}>
            <Text style={styles.loginText}>¿Ya tienes una cuenta?</Text>
            <TouchableOpacity
              onPress={() => navigation.navigate('Login')}
              disabled={loading}
            >
              <Text style={styles.loginLink}>Inicia sesión aquí</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: isMobile ? 20 : isTablet ? 40 : 0,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: isMobile ? 24 : 32,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
    maxWidth: isWeb ? 480 : '100%',
    width: isWeb ? '100%' : 'auto',
    alignSelf: 'center',
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  logo: {
    width: isMobile ? 200 : 240,
    height: isMobile ? 80 : 100,
  },
  title: {
    fontSize: isMobile ? 20 : 24,
    fontWeight: 'bold',
    color: '#111827',
    textAlign: 'center',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: isMobile ? 16 : 18,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 32,
  },
  form: {
    marginBottom: 24,
  },
  label: {
    fontSize: 14,
    color: '#374151',
    marginBottom: 8,
    fontWeight: '500',
  },
  input: {
    height: 48,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    paddingHorizontal: 16,
    marginBottom: 16,
    fontSize: 16,
    color: '#111827',
    backgroundColor: '#F9FAFB',
  },
  inputFocused: {
    borderColor: '#3B82F6',
    backgroundColor: '#FFFFFF',
  },
  pickerContainer: {
    justifyContent: 'center',
  },
  picker: {
    width: '100%',
    color: '#111827',
  },
  registerButton: {
    height: 48,
    backgroundColor: '#3B82F6',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  loginContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 16,
  },
  loginText: {
    color: '#6B7280',
    fontSize: 14,
    marginRight: 4,
  },
  loginLink: {
    color: '#3B82F6',
    fontSize: 14,
    fontWeight: '600',
  },
});