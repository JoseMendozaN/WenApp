import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  Image,
  ActivityIndicator,
  SafeAreaView,
  Platform
} from 'react-native';
import { supabase } from '../../lib/supabase';
import Icon from 'react-native-vector-icons/MaterialIcons';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import { decode } from 'base64-arraybuffer';
import { Picker } from '@react-native-picker/picker';
import { useNavigation } from '@react-navigation/native';
import 'react-native-get-random-values';
import { v4 as uuidv4 } from 'uuid';

const AgregarUsuariosScreen = () => {
  const navigation = useNavigation();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    nombreusuario: '',
    email: '',
    password: '',
    rol: 'maestro',
  });
  const [profileImage, setProfileImage] = useState(null);
  const [scheduleImage, setScheduleImage] = useState(null);
  const [adminSession, setAdminSession] = useState(null);

  useEffect(() => {
    const initializeScreen = async () => {
      try {
        // Verificar sesión de administrador
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError || !session) {
          Alert.alert('Acceso denegado', 'Debes iniciar sesión como administrador para agregar usuarios');
          navigation.goBack();
          return;
        }
        
        setAdminSession(session);
        
        // Verificar permisos de galería
        if (Platform.OS !== 'web') {
          const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
          if (status !== 'granted') {
            Alert.alert('Permisos requeridos', 'Necesitamos acceso a tu galería para seleccionar imágenes');
          }
        }
        
      } catch (error) {
        console.error('Error inicializando pantalla:', error);
        Alert.alert('Error', 'Ocurrió un error al cargar la pantalla');
        navigation.goBack();
      }
    };

    initializeScreen();
  }, []);

  const handleChange = (name, value) => {
    setFormData({
      ...formData,
      [name]: value
    });
  };

  const pickImage = async (type) => {
    try {
      let result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaType.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });
      
      if (!result.canceled) {
        if (type === 'profile') {
          setProfileImage(result.assets[0].uri);
        } else {
          setScheduleImage(result.assets[0].uri);
        }
      }
    } catch (error) {
      console.error('Error al seleccionar imagen:', error);
      Alert.alert('Error', 'No se pudo seleccionar la imagen');
    }
  };

  const uploadImage = async (uri, pathPrefix) => {
    try {
      const BUCKET_NAME = 'imagenes-usuarios';
      
      // Generar un nombre de archivo único
      const uniqueId = uuidv4();
      const fileExt = uri.split('.').pop().toLowerCase();
      const fileName = `${pathPrefix}_${uniqueId}.${fileExt}`;
      
      // Leer la imagen como base64
      const base64 = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      
      // Subir la imagen
      const { data, error } = await supabase
        .storage
        .from(BUCKET_NAME)
        .upload(fileName, decode(base64), {
          contentType: `image/${fileExt === 'png' ? 'png' : 'jpeg'}`,
          upsert: false,
          cacheControl: '3600'
        });
        
      if (error) throw error;
      
      // Obtener URL pública
      const { data: { publicUrl } } = await supabase
        .storage
        .from(BUCKET_NAME)
        .getPublicUrl(data.path);
      
      return publicUrl;
    } catch (error) {
      console.error('Error subiendo imagen:', error);
      throw new Error('No se pudo subir la imagen. Verifica tu conexión y permisos.');
    }
  };

  const handleSubmit = async () => {
    // Validaciones básicas
    if (!formData.nombreusuario || !formData.email || !formData.password) {
      Alert.alert('Error', 'Por favor complete todos los campos obligatorios');
      return;
    }
    
    if (formData.password.length < 6) {
      Alert.alert('Error', 'La contraseña debe tener al menos 6 caracteres');
      return;
    }
    
    if (!/^\S+@\S+\.\S+$/.test(formData.email)) {
      Alert.alert('Error', 'Por favor ingrese un correo electrónico válido');
      return;
    }
    
    setLoading(true);
    
    try {
      // 1. Verificar si el correo ya existe
      const { data: existingUser, error: emailError } = await supabase
        .from('usuarios')
        .select('email')
        .eq('email', formData.email)
        .single();
        
      if (existingUser) {
        Alert.alert('Error', 'Este correo electrónico ya está registrado');
        setLoading(false);
        return;
      }
      
      // 2. Crear usuario en Auth
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          data: {
            full_name: formData.nombreusuario,
            rol: formData.rol
          }
        }
      });
      
      if (authError) throw authError;
      
      // 3. Subir imágenes si existen
      let profileUrl = null;
      let scheduleUrl = null;
      
      if (profileImage) {
        try {
          profileUrl = await uploadImage(profileImage, `profile_${authData.user.id}`);
        } catch (uploadError) {
          console.error('Error subiendo foto de perfil:', uploadError);
          Alert.alert('Advertencia', 'No se pudo subir la foto de perfil. El usuario se creará sin ella.');
        }
      }
      
      if (scheduleImage) {
        try {
          scheduleUrl = await uploadImage(scheduleImage, `schedule_${authData.user.id}`);
        } catch (uploadError) {
          console.error('Error subiendo horario:', uploadError);
          Alert.alert('Advertencia', 'No se pudo subir el horario. El usuario se creará sin él.');
        }
      }
      
      // 4. Crear registro en la tabla usuarios
      const { error: dbError } = await supabase
        .from('usuarios')
        .insert({
          idusuario: authData.user.id,
          nombreusuario: formData.nombreusuario,
          email: formData.email,
          rol: formData.rol,
          fotoperfil: profileUrl,
          fotohorario: scheduleUrl
        });
        
      if (dbError) throw dbError;
      
      Alert.alert(
        'Éxito',
        'Usuario creado correctamente. Se ha enviado un correo de confirmación.',
        [{ text: 'Aceptar', onPress: () => navigation.goBack() }]
      );
    } catch (error) {
      console.error('Error en handleSubmit:', error);
      
      if (error.code === '23505') {
        Alert.alert('Error', 'Este usuario ya existe en el sistema');
      } else {
        Alert.alert(
          'Error', 
          error.message || 'Ocurrió un error al crear el usuario. Por favor intente nuevamente.'
        );
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {/* Header con menú */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => navigation.openDrawer()}
            style={styles.menuButton}
            hitSlop={{top: 20, bottom: 20, left: 20, right: 20}}
          >
            <Icon name="menu" size={24} color="#2c3e50" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Agregar Nuevo Usuario</Text>
          <View style={{ width: 24 }} />
        </View>
        
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.formContainer}>
            {/* Información básica */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Información Básica</Text>
              
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Nombre Completo *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Ej: Juan Pérez"
                  value={formData.nombreusuario}
                  onChangeText={(text) => handleChange('nombreusuario', text)}
                  autoCapitalize="words"
                  editable={!loading}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Correo Electrónico *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Ej: usuario@escuela.com"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoComplete="email"
                  value={formData.email}
                  onChangeText={(text) => handleChange('email', text)}
                  editable={!loading}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Contraseña *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Mínimo 6 caracteres"
                  secureTextEntry
                  value={formData.password}
                  onChangeText={(text) => handleChange('password', text)}
                  editable={!loading}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Rol *</Text>
                <View style={styles.pickerContainer}>
                  <Picker
                    selectedValue={formData.rol}
                    onValueChange={(itemValue) => handleChange('rol', itemValue)}
                    style={styles.picker}
                    enabled={!loading}
                  >
                    <Picker.Item label="Administrador" value="admin" />
                    <Picker.Item label="Maestro" value="maestro" />
                    <Picker.Item label="Directivo" value="directivo" />
                    <Picker.Item label="Invitado" value="invitado" />
                  </Picker>
                </View>
              </View>
            </View>

            {/* Foto de perfil */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Foto de Perfil</Text>
              <TouchableOpacity
                style={[styles.imageUploadButton, loading && styles.disabledButton]}
                onPress={() => pickImage('profile')}
                disabled={loading}
              >
                {profileImage ? (
                  <Image
                    source={{ uri: profileImage }}
                    style={styles.imagePreview}
                    resizeMode="cover"
                  />
                ) : (
                  <View style={styles.imagePlaceholder}>
                    <Icon name="add-a-photo" size={24} color="#95a5a6" />
                    <Text style={styles.imagePlaceholderText}>Seleccionar imagen</Text>
                  </View>
                )}
              </TouchableOpacity>
            </View>

            {/* Horario */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Horario (Opcional)</Text>
              <TouchableOpacity
                style={[styles.imageUploadButton, loading && styles.disabledButton]}
                onPress={() => pickImage('schedule')}
                disabled={loading}
              >
                {scheduleImage ? (
                  <Image
                    source={{ uri: scheduleImage }}
                    style={styles.imagePreview}
                    resizeMode="cover"
                  />
                ) : (
                  <View style={styles.imagePlaceholder}>
                    <Icon name="schedule" size={24} color="#95a5a6" />
                    <Text style={styles.imagePlaceholderText}>Subir imagen de horario</Text>
                  </View>
                )}
              </TouchableOpacity>
            </View>

            {/* Botón de enviar */}
            <TouchableOpacity
              style={[styles.submitButton, loading && styles.disabledButton]}
              onPress={handleSubmit}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.submitButtonText}>Registrar Usuario</Text>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  menuButton: {
    marginRight: 16,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#2c3e50',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 24,
  },
  formContainer: {
    padding: 16,
  },
  section: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2c3e50',
    marginBottom: 16,
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    color: '#6c757d',
    marginBottom: 8,
    fontWeight: '500',
  },
  input: {
    backgroundColor: '#f8f9fa',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  pickerContainer: {
    backgroundColor: '#f8f9fa',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    overflow: 'hidden',
  },
  picker: {
    height: 50,
    width: '100%',
  },
  imageUploadButton: {
    width: '100%',
    aspectRatio: 4/3,
    backgroundColor: '#f8f9fa',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  imagePlaceholder: {
    alignItems: 'center',
  },
  imagePlaceholderText: {
    marginTop: 8,
    color: '#95a5a6',
    fontSize: 14,
  },
  imagePreview: {
    width: '100%',
    height: '100%',
  },
  submitButton: {
    backgroundColor: '#4a6da7',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginTop: 16,
  },
  disabledButton: {
    backgroundColor: '#95a5a6',
    opacity: 0.7,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default AgregarUsuariosScreen;