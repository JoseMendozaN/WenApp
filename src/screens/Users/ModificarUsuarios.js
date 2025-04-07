import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Dimensions,
  SafeAreaView,
  RefreshControl,
  FlatList,
  Alert,
  Modal,
  Image,
  ScrollView
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { Picker } from '@react-native-picker/picker';
import { useNavigation } from '@react-navigation/native';
import { supabase, supabaseAdmin } from '../../lib/supabase';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import { decode } from 'base64-arraybuffer';
import 'react-native-get-random-values';
import { v4 as uuidv4 } from 'uuid';

const { width } = Dimensions.get('window');
const isMobile = width < 768;
const MAX_CONTENT_WIDTH = 1200;

const ModificarUsuariosScreen = () => {
  const navigation = useNavigation();
  const [usuarios, setUsuarios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterRol, setFilterRol] = useState('todos');
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminLoading, setAdminLoading] = useState(true);
  
  // Estados para edición
  const [modalVisible, setModalVisible] = useState(false);
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [currentUsuario, setCurrentUsuario] = useState(null);
  const [formData, setFormData] = useState({
    nombreusuario: '',
    email: '',
    rol: 'maestro',
    fotoperfil: null,
    fotohorario: null
  });
  const [newProfileImage, setNewProfileImage] = useState(null);
  const [newScheduleImage, setNewScheduleImage] = useState(null);

  // Verificar rol de administrador al cargar el componente
  useEffect(() => {
    const checkAdminStatus = async () => {
      try {
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        if (!user) {
          navigation.navigate('Login');
          return;
        }

        const { data, error } = await supabase
          .from('usuarios')
          .select('rol')
          .eq('idusuario', user.id)
          .single();

        if (!error && data?.rol === 'admin') {
          setIsAdmin(true);
          fetchUsuarios();
        } else {
          Alert.alert('Acceso denegado', 'Solo los administradores pueden acceder a esta función');
        }
      } catch (error) {
        console.error('Error verificando admin:', error);
        Alert.alert('Error', 'No se pudo verificar el acceso');
      } finally {
        setAdminLoading(false);
      }
    };

    checkAdminStatus();
  }, []);

  // Cargar usuarios
  const fetchUsuarios = async () => {
    try {
      setRefreshing(true);
      
      let query = supabase
        .from('usuarios')
        .select('*');

      // Aplicar filtros adicionales
      if (searchQuery) {
        query = query.or(`nombreusuario.ilike.%${searchQuery}%,email.ilike.%${searchQuery}%`);
      }

      if (filterRol !== 'todos') {
        query = query.eq('rol', filterRol);
      }

      // Ordenar por nombre
      query = query.order('nombreusuario', { ascending: true });

      const { data, error } = await query;

      if (error) throw error;

      setUsuarios(data || []);
      
    } catch (error) {
      console.error('Error al cargar usuarios:', error);
      Alert.alert('Error', error.message || 'No se pudieron cargar los usuarios');
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  };

  // Manejar edición de usuario
  const handleEdit = (usuario) => {
    if (!isAdmin) {
      Alert.alert('Acceso denegado', 'Solo los administradores pueden editar usuarios');
      return;
    }

    setCurrentUsuario(usuario);
    setFormData({
      nombreusuario: usuario.nombreusuario,
      email: usuario.email,
      rol: usuario.rol,
      fotoperfil: usuario.fotoperfil,
      fotohorario: usuario.fotohorario
    });
    setNewProfileImage(null);
    setNewScheduleImage(null);
    setModalVisible(true);
  };

  // Manejar eliminación de usuario
  const handleDelete = (usuario) => {
    if (!isAdmin) {
      Alert.alert('Acceso denegado', 'Solo los administradores pueden eliminar usuarios');
      return;
    }
    setCurrentUsuario(usuario);
    setDeleteModalVisible(true);
  };

  const confirmDelete = async () => {
    try {
      setLoading(true);
      
      // 1. Primero eliminar de la tabla usuarios
      const { error: deleteError } = await supabaseAdmin
        .from('usuarios')
        .delete()
        .eq('idusuario', currentUsuario.idusuario);
  
      if (deleteError) throw deleteError;
      
      // 2. Luego eliminar el usuario de auth
      const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(
        currentUsuario.idusuario
      );
      
      if (authError) {
        // Si falla la eliminación de auth, pero ya eliminamos de la tabla usuarios
        console.warn('Usuario eliminado de la tabla pero no de auth:', authError);
        Alert.alert('Advertencia', 'Usuario eliminado pero hubo un problema con la autenticación');
      } else {
        Alert.alert('Éxito', 'Usuario eliminado correctamente');
      }
      
      setDeleteModalVisible(false);
      fetchUsuarios();
      
    } catch (error) {
      console.error('Error al eliminar usuario:', error);
      Alert.alert('Error', 'No se pudo eliminar el usuario: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleFormChange = (name, value) => {
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
          setNewProfileImage(result.assets[0].uri);
        } else {
          setNewScheduleImage(result.assets[0].uri);
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

  const handleUpdate = async () => {
    if (!isAdmin) {
      Alert.alert('Error', 'Solo los administradores pueden modificar usuarios');
      return;
    }
  
    // Validaciones básicas
    if (!formData.nombreusuario.trim()) {
      Alert.alert('Error', 'El nombre no puede estar vacío');
      return;
    }
    
    if (!formData.email.trim() || !/^\S+@\S+\.\S+$/.test(formData.email)) {
      Alert.alert('Error', 'Ingresa un correo electrónico válido');
      return;
    }
  
    try {
      setLoading(true);
      
      let profileUrl = formData.fotoperfil;
      let scheduleUrl = formData.fotohorario;
      
      // Subir nueva imagen de perfil si existe
      if (newProfileImage) {
        profileUrl = await uploadImage(newProfileImage, 'profile');
      }
      
      // Subir nueva imagen de horario si existe
      if (newScheduleImage) {
        scheduleUrl = await uploadImage(newScheduleImage, 'schedule');
      }
      
      // ACTUALIZACIÓN CORREGIDA - Usando supabase normal con políticas RLS adecuadas
      const { data, error } = await supabase
        .from('usuarios')
        .update({
          nombreusuario: formData.nombreusuario,
          email: formData.email,
          rol: formData.rol,
          fotoperfil: profileUrl,
          fotohorario: scheduleUrl
        })
        .eq('idusuario', currentUsuario.idusuario)
        .select();
  
      if (error) throw error;
      
      if (!data || data.length === 0) {
        throw new Error('No se recibió confirmación de la actualización');
      }
      
      // Actualizar email en auth (esto requiere permisos elevados)
      if (formData.email !== currentUsuario.email) {
        // NOTA: Esto solo funciona si tienes una función backend configurada
        const { error: authError } = await supabase.auth.updateUser({
          email: formData.email
        });
  
        if (authError) {
          console.warn('No se pudo actualizar el email en Auth:', authError);
          // Puedes decidir si quieres continuar o lanzar el error
        }
      }
      
      Alert.alert('Éxito', 'Usuario actualizado correctamente');
      setModalVisible(false);
      fetchUsuarios();
      
    } catch (error) {
      console.error('Error al actualizar usuario:', error);
      Alert.alert('Error', 'No se pudo actualizar el usuario: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Color según rol
  const getRolColor = (rol) => {
    switch(rol) {
      case 'admin': return '#e74c3c';
      case 'maestro': return '#3498db';
      case 'directivo': return '#9b59b6';
      case 'invitado': return '#2ecc71';
      default: return '#95a5a6';
    }
  };

  // Renderizar cada item de usuario
  const renderItem = ({ item }) => (
    <View style={styles.itemContainer}>
      <View style={styles.itemHeader}>
        {item.fotoperfil ? (
          <Image source={{ uri: item.fotoperfil }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, styles.avatarPlaceholder]}>
            <Icon name="person" size={24} color="#fff" />
          </View>
        )}
        
        <View style={styles.userInfo}>
          <Text style={styles.itemName}>{item.nombreusuario}</Text>
          <Text style={styles.itemEmail}>{item.email}</Text>
        </View>
        
        <View style={[styles.rolBadge, { backgroundColor: getRolColor(item.rol) }]}>
          <Text style={styles.rolText}>{item.rol.toUpperCase()}</Text>
        </View>
      </View>
      
      <View style={styles.itemActions}>
        <TouchableOpacity 
          style={[styles.actionButton, styles.editButton]}
          onPress={() => handleEdit(item)}
        >
          <Icon name="edit" size={18} color="white" />
          <Text style={styles.actionButtonText}>Editar</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.actionButton, styles.deleteButton]}
          onPress={() => handleDelete(item)}
        >
          <Icon name="delete" size={18} color="white" />
          <Text style={styles.actionButtonText}>Eliminar</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  if (adminLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#4a6da7" />
      </View>
    );
  }

  if (!isAdmin) {
    return (
      <View style={styles.centered}>
        <Icon name="warning" size={48} color="#e74c3c" />
        <Text style={styles.accessDeniedText}>Acceso restringido a administradores</Text>
        <TouchableOpacity
          style={styles.goBackButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.goBackButtonText}>Volver</Text>
        </TouchableOpacity>
      </View>
    );
  }

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
          <Text style={styles.headerTitle}>Administrar Usuarios</Text>
          <Text style={styles.headerSubtitle}>Total: {usuarios.length} usuarios</Text>
        </View>

        <ScrollView 
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.content}>
            {/* Controles de búsqueda y filtro */}
            <View style={styles.controlsContainer}>
              <View style={styles.searchContainer}>
                <Icon name="search" size={20} color="#95a5a6" style={styles.searchIcon} />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Buscar usuarios..."
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  placeholderTextColor="#95a5a6"
                />
                <TouchableOpacity 
                  style={styles.searchButton}
                  onPress={fetchUsuarios}
                >
                  <Text style={styles.searchButtonText}>Buscar</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.filterContainer}>
                <Text style={styles.filterLabel}>Filtrar por rol:</Text>
                <View style={styles.pickerContainer}>
                  <Picker
                    selectedValue={filterRol}
                    onValueChange={(value) => setFilterRol(value)}
                    style={styles.picker}
                  >
                    <Picker.Item label="Todos" value="todos" />
                    <Picker.Item label="Administrador" value="admin" />
                    <Picker.Item label="Maestro" value="maestro" />
                    <Picker.Item label="Directivo" value="directivo" />
                    <Picker.Item label="Invitado" value="invitado" />
                  </Picker>
                </View>
              </View>
            </View>

            {/* Lista de usuarios */}
            {loading && !refreshing ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#4a6da7" />
              </View>
            ) : usuarios.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Icon name="info-outline" size={48} color="#95a5a6" />
                <Text style={styles.emptyText}>No se encontraron usuarios</Text>
                <TouchableOpacity 
                  style={styles.refreshButton}
                  onPress={fetchUsuarios}
                >
                  <Text style={styles.refreshButtonText}>Recargar</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <FlatList
                data={usuarios}
                renderItem={renderItem}
                keyExtractor={item => item.idusuario}
                contentContainerStyle={styles.listContent}
                refreshControl={
                  <RefreshControl
                    refreshing={refreshing}
                    onRefresh={fetchUsuarios}
                    colors={['#4a6da7']}
                  />
                }
              />
            )}

            {/* Modal de Edición */}
            <Modal
              animationType="slide"
              transparent={true}
              visible={modalVisible}
              onRequestClose={() => setModalVisible(false)}
            >
              <View style={styles.modalContainer}>
                <View style={styles.modalContent}>
                  <Text style={styles.modalTitle}>Editar Usuario</Text>
                  
                  <View style={styles.formGroup}>
                    <Text style={styles.label}>Nombre Completo*</Text>
                    <TextInput
                      style={styles.input}
                      value={formData.nombreusuario}
                      onChangeText={(text) => handleFormChange('nombreusuario', text)}
                      placeholder="Nombre del usuario"
                    />
                  </View>

                  <View style={styles.formGroup}>
                    <Text style={styles.label}>Correo Electrónico*</Text>
                    <TextInput
                      style={styles.input}
                      value={formData.email}
                      onChangeText={(text) => handleFormChange('email', text)}
                      placeholder="Correo electrónico"
                      keyboardType="email-address"
                      autoCapitalize="none"
                    />
                  </View>

                  <View style={styles.formGroup}>
                    <Text style={styles.label}>Rol*</Text>
                    <View style={styles.pickerContainer}>
                      <Picker
                        selectedValue={formData.rol}
                        onValueChange={(value) => handleFormChange('rol', value)}
                        style={styles.picker}
                      >
                        <Picker.Item label="Administrador" value="admin" />
                        <Picker.Item label="Maestro" value="maestro" />
                        <Picker.Item label="Directivo" value="directivo" />
                        <Picker.Item label="Invitado" value="invitado" />
                      </Picker>
                    </View>
                  </View>

                  <View style={styles.formGroup}>
                    <Text style={styles.label}>Foto de Perfil</Text>
                    <TouchableOpacity 
                      style={styles.imageUploadButton}
                      onPress={() => pickImage('profile')}
                    >
                      {newProfileImage ? (
                        <Image source={{ uri: newProfileImage }} style={styles.imagePreview} />
                      ) : formData.fotoperfil ? (
                        <Image source={{ uri: formData.fotoperfil }} style={styles.imagePreview} />
                      ) : (
                        <View style={styles.imagePlaceholder}>
                          <Icon name="add-a-photo" size={24} color="#95a5a6" />
                          <Text style={styles.imagePlaceholderText}>Seleccionar imagen</Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  </View>

                  <View style={styles.formGroup}>
                    <Text style={styles.label}>Horario</Text>
                    <TouchableOpacity 
                      style={styles.imageUploadButton}
                      onPress={() => pickImage('schedule')}
                    >
                      {newScheduleImage ? (
                        <Image source={{ uri: newScheduleImage }} style={styles.imagePreview} />
                      ) : formData.fotohorario ? (
                        <Image source={{ uri: formData.fotohorario }} style={styles.imagePreview} />
                      ) : (
                        <View style={styles.imagePlaceholder}>
                          <Icon name="schedule" size={24} color="#95a5a6" />
                          <Text style={styles.imagePlaceholderText}>Subir horario</Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  </View>

                  <View style={styles.modalButtons}>
                    <TouchableOpacity 
                      style={[styles.modalButton, styles.cancelButton]}
                      onPress={() => setModalVisible(false)}
                      disabled={loading}
                    >
                      <Text style={styles.modalButtonText}>Cancelar</Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                      style={[styles.modalButton, styles.saveButton]}
                      onPress={handleUpdate}
                      disabled={loading}
                    >
                      {loading ? (
                        <ActivityIndicator color="white" />
                      ) : (
                        <Text style={styles.modalButtonText}>Guardar</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            </Modal>

            {/* Modal de Confirmación para Eliminar */}
            <Modal
              animationType="fade"
              transparent={true}
              visible={deleteModalVisible}
              onRequestClose={() => setDeleteModalVisible(false)}
            >
              <View style={styles.modalContainer}>
                <View style={styles.modalContent}>
                  <Text style={styles.modalTitle}>Confirmar Eliminación</Text>
                  
                  <Text style={styles.deleteConfirmationText}>
                    ¿Estás seguro que deseas eliminar al usuario {currentUsuario?.nombreusuario}?
                  </Text>
                  <Text style={styles.deleteWarningText}>
                    Esta acción no se puede deshacer y eliminará todos los datos asociados al usuario.
                  </Text>

                  <View style={styles.modalButtons}>
                    <TouchableOpacity 
                      style={[styles.modalButton, styles.cancelButton]}
                      onPress={() => setDeleteModalVisible(false)}
                      disabled={loading}
                    >
                      <Text style={styles.modalButtonText}>Cancelar</Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                      style={[styles.modalButton, styles.deleteButton]}
                      onPress={confirmDelete}
                      disabled={loading}
                    >
                      {loading ? (
                        <ActivityIndicator color="white" />
                      ) : (
                        <Text style={styles.modalButtonText}>Eliminar</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            </Modal>
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
  scrollContent: {
    flexGrow: 1,
  },
  content: {
    width: '100%',
    maxWidth: MAX_CONTENT_WIDTH,
    alignSelf: 'center',
    paddingHorizontal: isMobile ? 16 : 24,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  accessDeniedText: {
    fontSize: 18,
    color: '#e74c3c',
    marginVertical: 20,
    textAlign: 'center',
  },
  goBackButton: {
    backgroundColor: '#4a6da7',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 6,
  },
  goBackButtonText: {
    color: 'white',
    fontWeight: '500',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    paddingVertical: 16,
    paddingHorizontal: isMobile ? 16 : 24,
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
    fontSize: isMobile ? 18 : 20,
    fontWeight: '600',
    color: '#2c3e50',
    flex: 1,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#7f8c8d',
    marginLeft: 12,
  },
  controlsContainer: {
    padding: isMobile ? 16 : 24,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    marginTop: 24,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    marginBottom: 12,
  },
  searchIcon: {
    marginLeft: 12,
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    height: 40,
    fontSize: 16,
    color: '#2c3e50',
    paddingHorizontal: 8,
  },
  searchButton: {
    backgroundColor: '#4a6da7',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderTopRightRadius: 8,
    borderBottomRightRadius: 8,
  },
  searchButtonText: {
    color: 'white',
    fontWeight: '600',
  },
  filterContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  filterLabel: {
    fontSize: 14,
    color: '#7f8c8d',
    marginRight: 8,
  },
  pickerContainer: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    overflow: 'hidden',
  },
  picker: {
    height: 40,
    width: '100%',
  },
  listContent: {
    padding: isMobile ? 8 : 16,
  },
  itemContainer: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 2,
  },
  itemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 12,
  },
  avatarPlaceholder: {
    backgroundColor: '#95a5a6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  userInfo: {
    flex: 1,
  },
  itemName: {
    fontSize: 18,
    fontWeight: '500',
    color: '#2c3e50',
  },
  itemEmail: {
    fontSize: 14,
    color: '#7f8c8d',
  },
  rolBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  rolText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#ffffff',
  },
  itemActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 8,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    marginLeft: 8,
  },
  editButton: {
    backgroundColor: '#4a6da7',
  },
  deleteButton: {
    backgroundColor: '#e74c3c',
  },
  actionButtonText: {
    color: 'white',
    marginLeft: 6,
    fontWeight: '500',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyText: {
    fontSize: 18,
    color: '#95a5a6',
    marginTop: 16,
  },
  refreshButton: {
    marginTop: 16,
    backgroundColor: '#4a6da7',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 6,
  },
  refreshButtonText: {
    color: 'white',
    fontWeight: '500',
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalContent: {
    width: isMobile ? '90%' : '70%',
    maxWidth: 500,
    backgroundColor: 'white',
    borderRadius: 10,
    padding: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#2c3e50',
    marginBottom: 20,
    textAlign: 'center',
  },
  deleteConfirmationText: {
    fontSize: 16,
    color: '#2c3e50',
    marginBottom: 10,
    textAlign: 'center',
  },
  deleteWarningText: {
    fontSize: 14,
    color: '#e74c3c',
    marginBottom: 20,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  formGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    color: '#7f8c8d',
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 6,
    padding: 10,
    fontSize: 16,
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
  imagePreview: {
    width: '100%',
    height: '100%',
  },
  imagePlaceholder: {
    alignItems: 'center',
  },
  imagePlaceholderText: {
    marginTop: 8,
    color: '#95a5a6',
    fontSize: 14,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
  },
  modalButton: {
    flex: 1,
    padding: 12,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#95a5a6',
    marginRight: 8,
  },
  saveButton: {
    backgroundColor: '#4a6da7',
  },
  deleteButton: {
    backgroundColor: '#e74c3c',
  },
  modalButtonText: {
    color: 'white',
    fontWeight: '500',
  },
});

export default ModificarUsuariosScreen;