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
  Platform
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

const AgregarMantenimientoScreen = () => {
  const navigation = useNavigation();
  const [loading, setLoading] = useState(false);
  const [equipos, setEquipos] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [filtroCategoria, setFiltroCategoria] = useState('');
  const [formData, setFormData] = useState({
    idequipo: '',
    fechamantenimiento: new Date(),
    horamantenimiento: new Date(),
    tipomantenimiento: 'Preventivo'
  });
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePickerInicio, setShowTimePickerInicio] = useState(false);
  const [user, setUser] = useState(null);

  // Obtener usuario actual
  useEffect(() => {
    const fetchUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
    };
    fetchUser();
  }, []);

  // Obtener categorías de equipos
  useEffect(() => {
    const fetchCategorias = async () => {
      try {
        const { data, error } = await supabase
          .from('categoriasequipos')
          .select('idcategoria, nombrecategoria')
          .order('nombrecategoria', { ascending: true });

        if (error) throw error;
        setCategorias(data || []);
      } catch (error) {
        Alert.alert('Error', 'No se pudieron cargar las categorías');
        console.error('Error fetching categories:', error);
      }
    };

    fetchCategorias();
  }, []);

  // Obtener equipos disponibles
  useEffect(() => {
    const fetchEquiposDisponibles = async () => {
      try {
        setLoading(true);
        
        let query = supabase
          .from('equipos')
          .select('idequipo, nombreequipo, idcategoria')
          .eq('estado', 'disponible')
          .order('nombreequipo', { ascending: true });

        if (filtroCategoria) {
          query = query.eq('idcategoria', filtroCategoria);
        }

        const { data, error } = await query;

        if (error) throw error;
        setEquipos(data || []);
      } catch (error) {
        Alert.alert('Error', 'No se pudieron cargar los equipos disponibles');
        console.error('Error fetching equipment:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchEquiposDisponibles();
  }, [filtroCategoria]);

  const handleChange = (name, value) => {
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleDateChange = (event, selectedDate) => {
    setShowDatePicker(Platform.OS === 'ios');
    if (selectedDate) {
      handleChange('fechamantenimiento', selectedDate);
    }
  };

  const handleTimeChangeInicio = (event, selectedTime) => {
    setShowTimePickerInicio(Platform.OS === 'ios');
    if (selectedTime) {
      handleChange('horamantenimiento', selectedTime);
    }
  };

  const handleSubmit = async () => {
    if (!formData.idequipo) {
      Alert.alert('Error', 'Por favor seleccione un equipo disponible');
      return;
    }

    if (!user) {
      Alert.alert('Error', 'No se pudo identificar al usuario');
      return;
    }

    setLoading(true);
    try {
      const fechaFormateada = formData.fechamantenimiento.toISOString().split('T')[0];
      const horaInicioFormateada = formData.horamantenimiento.toTimeString().substring(0, 8);

      // Insertar en historial_mantenimiento con valores por defecto
      const { data, error } = await supabase
        .from('historial_mantenimiento')
        .insert([{
          idequipo: parseInt(formData.idequipo),
          fechamantenimiento: fechaFormateada,
          horamantenimiento: horaInicioFormateada,
          tipomantenimiento: formData.tipomantenimiento,
          observaciones: null, // Se llenará en otra interfaz
          accion: 'Registro inicial', // Valor temporal, se actualizará después
          idusuario: user.id
        }])
        .select();

      if (error) throw error;

      // Actualizar estado del equipo
      const { error: equipoError } = await supabase
        .from('equipos')
        .update({ estado: 'en mantenimiento' })
        .eq('idequipo', parseInt(formData.idequipo));

      if (equipoError) throw equipoError;

      Alert.alert('Éxito', 'Mantenimiento registrado correctamente');
      navigation.goBack();
    } catch (error) {
      Alert.alert('Error', 'No se pudo registrar el mantenimiento');
      console.error('Error adding maintenance:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity 
            onPress={() => navigation.goBack()}
            style={styles.backButton}
          >
            <MaterialIcons name="arrow-back" size={24} color="#2c3e50" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Agregar Mantenimiento</Text>
        </View>
        
        <ScrollView 
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.content}>
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardTitle}>Registrar Nuevo Mantenimiento</Text>
              </View>
              
              <View style={styles.cardBody}>
                {/* Filtro por categoría */}
                <View style={styles.formGroup}>
                  <Text style={styles.label}>Filtrar por categoría</Text>
                  <View style={[
                    styles.pickerContainer,
                    Platform.OS === 'android' && styles.androidPickerContainer
                  ]}>
                    <Picker
                      selectedValue={filtroCategoria}
                      onValueChange={(value) => setFiltroCategoria(value)}
                      style={styles.picker}
                      dropdownIconColor="#666"
                      mode={Platform.OS === 'android' ? 'dropdown' : 'dialog'}
                    >
                      <Picker.Item label="Todas las categorías" value="" />
                      {categorias.map(categoria => (
                        <Picker.Item 
                          key={categoria.idcategoria} 
                          label={categoria.nombrecategoria} 
                          value={categoria.idcategoria.toString()} 
                        />
                      ))}
                    </Picker>
                  </View>
                </View>

                {/* Selección de equipo */}
                <View style={styles.formGroup}>
                  <Text style={styles.label}>Equipo Disponible *</Text>
                  <View style={[
                    styles.pickerContainer,
                    Platform.OS === 'android' && styles.androidPickerContainer
                  ]}>
                    <Picker
                      selectedValue={formData.idequipo}
                      onValueChange={(value) => handleChange('idequipo', value)}
                      style={styles.picker}
                      dropdownIconColor="#666"
                      mode={Platform.OS === 'android' ? 'dropdown' : 'dialog'}
                    >
                      <Picker.Item label="Seleccione un equipo disponible" value="" />
                      {equipos.map(equipo => (
                        <Picker.Item 
                          key={equipo.idequipo} 
                          label={equipo.nombreequipo}
                          value={equipo.idequipo.toString()} 
                        />
                      ))}
                    </Picker>
                  </View>
                </View>

                {/* Fecha y hora */}
                <View style={styles.formRow}>
                  <View style={[styles.formGroup, styles.flex1, styles.marginRight]}>
                    <Text style={styles.label}>Fecha de mantenimiento *</Text>
                    <TouchableOpacity 
                      style={styles.dateInput}
                      onPress={() => setShowDatePicker(true)}
                    >
                      <Text>{formData.fechamantenimiento.toLocaleDateString()}</Text>
                      <MaterialIcons name="calendar-today" size={20} color="#666" />
                    </TouchableOpacity>
                    {(showDatePicker || Platform.OS === 'ios') && (
                      <DateTimePicker
                        value={formData.fechamantenimiento}
                        mode="date"
                        display={Platform.OS === 'ios' ? 'inline' : 'default'}
                        onChange={handleDateChange}
                        minimumDate={new Date()}
                      />
                    )}
                  </View>

                  <View style={[styles.formGroup, styles.flex1]}>
                    <Text style={styles.label}>Hora de inicio *</Text>
                    <TouchableOpacity 
                      style={styles.dateInput}
                      onPress={() => setShowTimePickerInicio(true)}
                    >
                      <Text>{formData.horamantenimiento.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
                      <MaterialIcons name="access-time" size={20} color="#666" />
                    </TouchableOpacity>
                    {(showTimePickerInicio || Platform.OS === 'ios') && (
                      <DateTimePicker
                        value={formData.horamantenimiento}
                        mode="time"
                        display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                        onChange={handleTimeChangeInicio}
                      />
                    )}
                  </View>
                </View>

                {/* Tipo de mantenimiento */}
                <View style={styles.formGroup}>
                  <Text style={styles.label}>Tipo de mantenimiento *</Text>
                  <View style={[
                    styles.pickerContainer,
                    Platform.OS === 'android' && styles.androidPickerContainer
                  ]}>
                    <Picker
                      selectedValue={formData.tipomantenimiento}
                      onValueChange={(value) => handleChange('tipomantenimiento', value)}
                      style={styles.picker}
                      dropdownIconColor="#666"
                      mode={Platform.OS === 'android' ? 'dropdown' : 'dialog'}
                    >
                      <Picker.Item label="Preventivo" value="Preventivo" />
                      <Picker.Item label="Correctivo" value="Correctivo" />
                    </Picker>
                  </View>
                </View>

                {/* Botón de enviar */}
                <TouchableOpacity 
                  style={[styles.button, (loading || !formData.idequipo) && styles.disabledButton]}
                  onPress={handleSubmit}
                  disabled={loading || !formData.idequipo}
                >
                  {loading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <View style={styles.buttonContent}>
                      <MaterialCommunityIcons name="toolbox" size={20} color="#fff" />
                      <Text style={styles.buttonText}>Registrar Mantenimiento</Text>
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

// Estilos (se mantienen iguales que en la versión anterior)
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
  backButton: {
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
  formRow: {
    flexDirection: isMobile ? 'column' : 'row',
    marginBottom: isMobile ? 0 : 20,
  },
  formGroup: {
    marginBottom: isMobile ? 20 : 0,
  },
  flex1: {
    flex: 1,
  },
  marginRight: {
    marginRight: isMobile ? 0 : 16,
  },
  label: {
    fontSize: 14,
    color: '#6c757d',
    marginBottom: 8,
    fontWeight: '500',
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

export default AgregarMantenimientoScreen;