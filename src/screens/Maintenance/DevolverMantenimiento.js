import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  Alert,
  ActivityIndicator,
  Dimensions,
  SafeAreaView,
  Platform,
  TextInput
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { useNavigation } from '@react-navigation/native';
import { supabase } from '../../lib/supabase';
import DateTimePicker from '@react-native-community/datetimepicker';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

const { width } = Dimensions.get('window');
const isMobile = width < 768;
const MAX_CONTENT_WIDTH = 1200;

const DevolverMantenimientoScreen = () => {
  const navigation = useNavigation();
  const [loading, setLoading] = useState(false);
  const [mantenimientos, setMantenimientos] = useState([]);
  const [formData, setFormData] = useState({
    idhistorialmantenimiento: '',
    horadevolucion: new Date(),
    observaciones: ''
    // Eliminado el campo accion del estado ya que será automático
  });
  const [showTimePickerDevolucion, setShowTimePickerDevolucion] = useState(false);
  const [user, setUser] = useState(null);

  // Obtener usuario actual
  useEffect(() => {
    const fetchUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
    };
    fetchUser();
  }, []);

  // Obtener mantenimientos activos
  useEffect(() => {
    const fetchMantenimientosActivos = async () => {
      try {
        setLoading(true);
        
        const { data, error } = await supabase
          .from('historial_mantenimiento')
          .select(`
            idhistorialmantenimiento, 
            idequipo, 
            fechamantenimiento,
            horamantenimiento,
            tipomantenimiento,
            equipos:equipos(nombreequipo),
            usuarios:usuarios(nombreusuario)
          `)
          .is('horadevolucion', null)
          .order('fechamantenimiento', { ascending: false });

        if (error) throw error;
        setMantenimientos(data || []);
      } catch (error) {
        Alert.alert('Error', 'No se pudieron cargar los mantenimientos activos');
        console.error('Error fetching maintenance:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchMantenimientosActivos();
  }, []);

  const handleChange = (name, value) => {
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleTimeChangeDevolucion = (event, selectedTime) => {
    setShowTimePickerDevolucion(Platform.OS === 'ios');
    if (selectedTime) {
      handleChange('horadevolucion', selectedTime);
    }
  };

  const handleSubmit = async () => {
    if (!formData.idhistorialmantenimiento) {
      Alert.alert('Error', 'Por favor seleccione un mantenimiento');
      return;
    }

    if (!user) {
      Alert.alert('Error', 'No se pudo identificar al usuario');
      return;
    }

    setLoading(true);
    try {
      const horaDevolucionFormateada = formData.horadevolucion.toTimeString().substring(0, 8);

      // 1. Actualizar el mantenimiento en historial_mantenimiento
      const { data: mantenimientoData, error: mantenimientoError } = await supabase
        .from('historial_mantenimiento')
        .update({
          horadevolucion: horaDevolucionFormateada,
          observaciones: formData.observaciones || null,
          accion: 'Mantenimiento completado' // Valor automático fijo
        })
        .eq('idhistorialmantenimiento', parseInt(formData.idhistorialmantenimiento))
        .select()
        .single();

      if (mantenimientoError) throw mantenimientoError;

      // 2. Obtener el idequipo del mantenimiento
      const mantenimientoSeleccionado = mantenimientos.find(
        m => m.idhistorialmantenimiento.toString() === formData.idhistorialmantenimiento
      );

      if (!mantenimientoSeleccionado) {
        throw new Error('No se encontró el mantenimiento seleccionado');
      }

      // 3. Actualizar el estado del equipo
      const { error: equipoError } = await supabase
        .from('equipos')
        .update({ estado: 'disponible' })
        .eq('idequipo', mantenimientoSeleccionado.idequipo);

      if (equipoError) throw equipoError;

      Alert.alert('Éxito', 'Devolución registrada correctamente');
      navigation.goBack();
    } catch (error) {
      Alert.alert('Error', 'No se pudo registrar la devolución');
      console.error('Error returning maintenance:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {/* Header con el mismo estilo del menú */}
        <View style={styles.header}>
          <TouchableOpacity 
            onPress={() => navigation.openDrawer()}
            style={styles.menuButton}
            hitSlop={{top: 20, bottom: 20, left: 20, right: 20}}
          >
            <MaterialIcons name="menu" size={24} color="#2c3e50" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Devolver Equipo de Mantenimiento</Text>
        </View>
        
        <ScrollView 
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.content}>
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardTitle}>Registrar Devolución</Text>
              </View>
              
              <View style={styles.cardBody}>
                {/* Selección de mantenimiento */}
                <View style={styles.formGroup}>
                  <Text style={styles.label}>Mantenimiento Activo *</Text>
                  <View style={[
                    styles.pickerContainer,
                    Platform.OS === 'android' && styles.androidPickerContainer
                  ]}>
                    <Picker
                      selectedValue={formData.idhistorialmantenimiento}
                      onValueChange={(value) => handleChange('idhistorialmantenimiento', value)}
                      style={styles.picker}
                      dropdownIconColor="#666"
                      mode={Platform.OS === 'android' ? 'dropdown' : 'dialog'}
                    >
                      <Picker.Item label="Seleccione un mantenimiento" value="" />
                      {mantenimientos.map(mantenimiento => (
                        <Picker.Item 
                          key={mantenimiento.idhistorialmantenimiento} 
                          label={`${mantenimiento.equipos.nombreequipo} - ${new Date(mantenimiento.fechamantenimiento).toLocaleDateString()} (${mantenimiento.tipomantenimiento})`}
                          value={mantenimiento.idhistorialmantenimiento.toString()} 
                        />
                      ))}
                    </Picker>
                  </View>
                </View>

                {/* Hora de devolución */}
                <View style={styles.formGroup}>
                  <Text style={styles.label}>Hora de devolución *</Text>
                  <TouchableOpacity 
                    style={styles.dateInput}
                    onPress={() => setShowTimePickerDevolucion(true)}
                  >
                    <Text>{formData.horadevolucion.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
                    <MaterialIcons name="access-time" size={20} color="#666" />
                  </TouchableOpacity>
                  {(showTimePickerDevolucion || Platform.OS === 'ios') && (
                    <DateTimePicker
                      value={formData.horadevolucion}
                      mode="time"
                      display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                      onChange={handleTimeChangeDevolucion}
                    />
                  )}
                </View>

                {/* Observaciones (se mantiene como campo opcional) */}
                <View style={styles.formGroup}>
                  <Text style={styles.label}>Observaciones</Text>
                  <View style={styles.textInputContainer}>
                    <TextInput
                      style={styles.textInput}
                      placeholder="Agregue observaciones adicionales (opcional)"
                      value={formData.observaciones}
                      onChangeText={(text) => handleChange('observaciones', text)}
                      multiline
                      numberOfLines={4}
                    />
                  </View>
                </View>

                {/* Botón de enviar */}
                <TouchableOpacity 
                  style={[styles.button, (loading || !formData.idhistorialmantenimiento) && styles.disabledButton]}
                  onPress={handleSubmit}
                  disabled={loading || !formData.idhistorialmantenimiento}
                >
                  {loading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <View style={styles.buttonContent}>
                      <MaterialCommunityIcons name="check-circle" size={20} color="#fff" />
                      <Text style={styles.buttonText}>Registrar Devolución</Text>
                    </View>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </ScrollView>
      </View>
    </SafeAreaView>
  );
};

// Estilos (se mantienen iguales)
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
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 24,
  },
  content: {
    width: '100%',
    maxWidth: MAX_CONTENT_WIDTH,
    alignSelf: 'center',
    paddingHorizontal: isMobile ? 16 : 24,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    marginTop: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  cardHeader: {
    padding: isMobile ? 16 : 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  cardTitle: {
    fontSize: isMobile ? 16 : 18,
    fontWeight: '600',
    color: '#2c3e50',
  },
  cardBody: {
    padding: isMobile ? 16 : 20,
  },
  formGroup: {
    marginBottom: 20,
  },
  pickerContainer: {
    borderWidth: 1,
    borderColor: '#ced4da',
    borderRadius: 6,
    overflow: 'hidden',
  },
  androidPickerContainer: {
    backgroundColor: '#f8f9fa',
  },
  picker: {
    height: 50,
    width: '100%',
    color: '#495057',
  },
  dateInput: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#ced4da',
    borderRadius: 6,
    padding: 12,
    height: 50,
  },
  textInputContainer: {
    borderWidth: 1,
    borderColor: '#ced4da',
    borderRadius: 6,
    padding: 12,
    minHeight: 100,
    backgroundColor: '#ffffff',
  },
  textInput: {
    textAlignVertical: 'top',
    color: '#495057',
  },
  button: {
    backgroundColor: '#4a6da7',
    borderRadius: 6,
    padding: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
    flexDirection: 'row',
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  disabledButton: {
    backgroundColor: '#95a5a6',
    opacity: 0.7,
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 10,
  },
});

export default DevolverMantenimientoScreen;