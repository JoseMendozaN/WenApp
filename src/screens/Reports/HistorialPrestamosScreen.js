import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Dimensions,
  Platform,
  Modal,
  TextInput,
  Linking,
  Alert
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { Button } from 'react-native-paper';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import { supabase } from '../../lib/supabase';

const { width } = Dimensions.get('window');
const isMobile = width < 768;
const MAX_CONTENT_WIDTH = 1200;
const isWeb = Platform.OS === 'web';

const HistorialPrestamosScreen = () => {
  const navigation = useNavigation();
  const [solicitudes, setSolicitudes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [directorNombre, setDirectorNombre] = useState('Lic. Juan Pérez');
  const [modalVisible, setModalVisible] = useState(false);
  const [nuevoNombre, setNuevoNombre] = useState('');

  // Cargar nombre del director
  useEffect(() => {
    const loadDirectorName = async () => {
      try {
        const savedName = await AsyncStorage.getItem('@director_name');
        if (savedName) setDirectorNombre(savedName);
      } catch (error) {
        console.error('Error al cargar nombre:', error);
      }
    };
    loadDirectorName();
    fetchSolicitudes();
  }, []);

  // Guardar nombre del director
  const saveDirectorName = async () => {
    if (!nuevoNombre.trim()) {
      Alert.alert('Error', 'Por favor ingrese un nombre válido');
      return;
    }

    try {
      await AsyncStorage.setItem('@director_name', nuevoNombre);
      setDirectorNombre(nuevoNombre);
      setModalVisible(false);
      Alert.alert('Éxito', 'Nombre actualizado correctamente');
    } catch (error) {
      Alert.alert('Error', 'No se pudo actualizar el nombre');
    }
  };

  // Obtener solicitudes de préstamo (actualizado a minúsculas)
  const fetchSolicitudes = async () => {
    setLoading(true);
    setRefreshing(true);
    
    try {
      const { data, error } = await supabase
        .from('solicitudes_prestamo')
        .select(`
          idsolicitud,
          tiposolicitud,
          fechasolicitud,
          horasolicitud,
          estado,
          usuarios:usuarios(nombreusuario, email),
          equipos:equipos(nombreequipo)
        `)
        .order('fechasolicitud', { ascending: false })
        .order('horasolicitud', { ascending: false });

      if (error) throw error;

      setSolicitudes(data || []);
    } catch (error) {
      Alert.alert('Error', 'No se pudieron cargar las solicitudes');
      console.error('Error fetching loan requests:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Aprobar o rechazar solicitud (actualizado a minúsculas)
  const handleCambiarEstado = async (idsolicitud, nuevoEstado) => {
    try {
      const { error } = await supabase
        .from('solicitudes_prestamo')
        .update({ estado: nuevoEstado })
        .eq('idsolicitud', idsolicitud);

      if (error) throw error;

      Alert.alert('Éxito', `Solicitud ${nuevoEstado === 'aprobado' ? 'aprobada' : 'rechazada'} correctamente`);
      fetchSolicitudes();
    } catch (error) {
      Alert.alert('Error', 'No se pudo actualizar el estado de la solicitud');
      console.error('Error updating request status:', error);
    }
  };

  // Generar documento para imprimir (actualizado a minúsculas)
  const generatePrintDocument = async () => {
    try {
      const htmlContent = `
        <html>
          <head>
            <meta charset="UTF-8">
            <style>
              body { font-family: Arial; padding: 20px; margin: 0; }
              .header { text-align: center; margin-bottom: 30px; padding-bottom: 20px; border-bottom: 2px solid #eee; }
              .logo { max-width: 200px; max-height: 100px; margin-bottom: 15px; }
              h1 { color: #2c3e50; margin: 5px 0; font-size: 24px; }
              .subtitle { color: #7f8c8d; font-size: 14px; }
              table { width: 100%; border-collapse: collapse; margin: 20px 0; font-size: 14px; }
              th, td { padding: 12px 8px; border: 1px solid #ddd; text-align: left; }
              th { background-color: #f8f9fa; font-weight: bold; color: #34495e; }
              .aprobado { color: #27ae60; }
              .rechazado { color: #e74c3c; }
              .pendiente { color: #f39c12; }
              .firma-container { margin-top: 60px; text-align: center; }
              .linea-firma { width: 300px; border-top: 1px solid #000; margin: 10px auto; }
              .nombre-director { font-weight: bold; margin-top: 5px; font-size: 16px; }
              .cargo-director { font-style: italic; color: #7f8c8d; }
              .footer { margin-top: 40px; text-align: center; font-size: 12px; color: #95a5a6; border-top: 1px solid #eee; padding-top: 15px; }
              @media print { body { padding: 0; } .no-print { display: none; } }
            </style>
          </head>
          <body>
            <div class="header">
              <img src="https://utregionaldelsur.sidci.mx/img/logo.png" class="logo" alt="Logo de la escuela">
              <h1>Reporte de Solicitudes de Préstamo</h1>
              <p class="subtitle">Generado el: ${new Date().toLocaleDateString('es-ES', { 
                weekday: 'long', 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
              })}</p>
            </div>
            
            <table>
              <thead>
                <tr>
                  <th>Equipo</th>
                  <th>Usuario</th>
                  <th>Email</th>
                  <th>Tipo</th>
                  <th>Fecha</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                ${solicitudes.map(item => `
                  <tr>
                    <td>${item.equipos?.nombreequipo || 'N/A'}</td>
                    <td>${item.usuarios?.nombreusuario || 'N/A'}</td>
                    <td>${item.usuarios?.email || 'N/A'}</td>
                    <td>${item.tiposolicitud}</td>
                    <td>${new Date(item.fechasolicitud).toLocaleDateString('es-ES')}</td>
                    <td class="${item.estado}">${item.estado.toUpperCase()}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
            
            <div class="firma-container">
              <div class="linea-firma"></div>
              <div class="nombre-director">${directorNombre}</div>
              <div class="cargo-director">Director de Carrera</div>
            </div>
            
            <div class="footer">
              <p>Sistema de Gestión de Préstamos - ${new Date().getFullYear()}</p>
              <p>Documento generado automáticamente - Válido sin firma manuscrita</p>
            </div>
          </body>
        </html>
      `;

      if (isWeb) {
        const printWindow = window.open('', '_blank');
        printWindow.document.write(htmlContent);
        printWindow.document.close();
        printWindow.focus();
        setTimeout(() => printWindow.print(), 500);
      } else {
        Alert.alert(
          'Documento Listo',
          Platform.OS === 'android' 
            ? 'Se abrirá en el navegador para imprimir' 
            : 'Para imprimir: 1. Abre en Safari 2. Usa Compartir → Imprimir',
          [
            { text: 'Cancelar', style: 'cancel' },
            { 
              text: 'Abrir Documento', 
              onPress: () => Linking.openURL(`data:text/html;charset=utf-8,${encodeURIComponent(htmlContent)}`)
            }
          ]
        );
      }
    } catch (error) {
      Alert.alert('Error', 'No se pudo generar el documento');
    }
  };

  // Renderizado de cada item (actualizado a minúsculas)
  const renderItem = ({ item }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle}>{item.equipos?.nombreequipo || 'Equipo no encontrado'}</Text>
        <View style={[
          styles.statusBadge,
          item.estado === 'aprobado' && styles.badgeAprobado,
          item.estado === 'rechazado' && styles.badgeRechazado,
          item.estado === 'pendiente' && styles.badgePendiente
        ]}>
          <Text style={styles.statusText}>{item.estado.toUpperCase()}</Text>
        </View>
      </View>
      
      <View style={styles.detailRow}>
        <Icon name="person-outline" size={16} color="#4a6da7" />
        <Text style={styles.detailText}>
          {item.usuarios?.nombreusuario || 'Usuario no encontrado'} ({item.usuarios?.email || 'N/A'})
        </Text>
      </View>
      
      <View style={styles.detailRow}>
        <Icon name="category" size={16} color="#4a6da7" />
        <Text style={styles.detailText}>Tipo: {item.tiposolicitud}</Text>
      </View>
      
      <View style={styles.detailRow}>
        <Icon name="date-range" size={16} color="#4a6da7" />
        <Text style={styles.detailText}>
          Fecha: {new Date(item.fechasolicitud).toLocaleDateString('es-ES')}
        </Text>
      </View>
      
      <View style={styles.detailRow}>
        <Icon name="access-time" size={16} color="#4a6da7" />
        <Text style={styles.detailText}>
          Hora: {new Date(item.horasolicitud).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
        </Text>
      </View>

      {item.estado === 'pendiente' && (
        <View style={styles.actionsContainer}>
          <TouchableOpacity 
            style={[styles.actionButton, styles.approveButton]}
            onPress={() => handleCambiarEstado(item.idsolicitud, 'aprobado')}
          >
            <Icon name="check" size={16} color="#FFF" />
            <Text style={styles.actionButtonText}>Aprobar</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.actionButton, styles.rejectButton]}
            onPress={() => handleCambiarEstado(item.idsolicitud, 'rechazado')}
          >
            <Icon name="close" size={16} color="#FFF" />
            <Text style={styles.actionButtonText}>Rechazar</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={[styles.container, isWeb && { maxWidth: MAX_CONTENT_WIDTH }]}>
        <View style={styles.header}>
          <TouchableOpacity 
            onPress={() => navigation.openDrawer()}
            style={styles.menuButton}
            hitSlop={{top: 20, bottom: 20, left: 20, right: 20}}
          >
            <Icon name="menu" size={24} color="#2c3e50" />
          </TouchableOpacity>
          
          <Text style={styles.headerTitle}>Solicitudes de Préstamo</Text>
          
          <View style={styles.buttonGroup}>
            <Button 
              mode="contained" 
              onPress={() => {
                setNuevoNombre(directorNombre);
                setModalVisible(true);
              }}
              style={styles.directorButton}
              labelStyle={styles.buttonLabel}
            >
              <Icon name="edit" size={18} color="#FFF" />
            </Button>
            
            <Button 
              mode="contained" 
              onPress={generatePrintDocument}
              style={styles.printButton}
              labelStyle={styles.buttonLabel}
            >
              <Icon name="print" size={18} color="#FFF" />
            </Button>
          </View>
        </View>

        <Modal 
          visible={modalVisible} 
          transparent={true}
          animationType="slide"
          onRequestClose={() => setModalVisible(false)}
        >
          <View style={styles.modalContainer}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Cambiar Nombre del Director</Text>
              
              <TextInput
                style={styles.input}
                value={nuevoNombre}
                onChangeText={setNuevoNombre}
                placeholder="Ingrese el nombre completo"
                placeholderTextColor="#95a5a6"
                autoFocus={true}
              />
              
              <View style={styles.modalButtons}>
                <Button 
                  mode="outlined" 
                  onPress={() => setModalVisible(false)}
                  style={styles.cancelButton}
                  labelStyle={styles.cancelButtonText}
                >
                  Cancelar
                </Button>
                <Button 
                  mode="contained" 
                  onPress={saveDirectorName}
                  style={styles.saveButton}
                  labelStyle={styles.saveButtonText}
                >
                  Guardar
                </Button>
              </View>
            </View>
          </View>
        </Modal>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#3498db" />
            <Text style={styles.loadingText}>Cargando solicitudes...</Text>
          </View>
        ) : (
          <FlatList
            data={solicitudes}
            renderItem={renderItem}
            keyExtractor={item => item.idsolicitud.toString()}
            contentContainerStyle={styles.listContent}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={fetchSolicitudes}
                colors={['#3498db']}
                tintColor="#3498db"
              />
            }
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Icon name="assignment" size={48} color="#ecf0f1" />
                <Text style={styles.emptyText}>No hay solicitudes de préstamo</Text>
                <Text style={styles.emptySubtext}>
                  No se encontraron solicitudes registradas
                </Text>
              </View>
            }
          />
        )}
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
    alignSelf: 'center',
    width: '100%',
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
  buttonGroup: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  directorButton: {
    backgroundColor: '#4a6da7',
    borderRadius: 4,
    marginRight: 8,
    minWidth: 40,
  },
  printButton: {
    backgroundColor: '#27ae60',
    borderRadius: 4,
    minWidth: 40,
  },
  buttonLabel: {
    color: '#FFF',
    marginVertical: 6,
    marginHorizontal: 0,
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalContent: {
    backgroundColor: '#FFF',
    borderRadius: 8,
    padding: 20,
    width: isMobile ? '90%' : '40%',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#2c3e50',
    marginBottom: 20,
    textAlign: 'center',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ced4da',
    borderRadius: 6,
    padding: 12,
    marginBottom: 20,
    fontSize: 16,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  cancelButton: {
    borderColor: '#95a5a6',
    flex: 1,
    marginRight: 10,
  },
  cancelButtonText: {
    color: '#95a5a6',
  },
  saveButton: {
    backgroundColor: '#4a6da7',
    flex: 1,
  },
  saveButtonText: {
    color: '#FFF',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#6c757d',
  },
  listContent: {
    padding: isMobile ? 8 : 16,
  },
  card: {
    backgroundColor: '#FFF',
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2c3e50',
  },
  statusBadge: {
    borderRadius: 12,
    paddingVertical: 4,
    paddingHorizontal: 10,
  },
  badgeAprobado: {
    backgroundColor: '#d5f5e3',
  },
  badgeRechazado: {
    backgroundColor: '#fadbd8',
  },
  badgePendiente: {
    backgroundColor: '#fdebd0',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '500',
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 4,
  },
  detailText: {
    fontSize: 14,
    color: '#6c757d',
    marginLeft: 8,
  },
  actionsContainer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 12,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 4,
    marginLeft: 8,
  },
  approveButton: {
    backgroundColor: '#27ae60',
  },
  rejectButton: {
    backgroundColor: '#e74c3c',
  },
  actionButtonText: {
    color: '#FFF',
    marginLeft: 4,
    fontSize: 14,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyText: {
    fontSize: 16,
    color: '#95a5a6',
    marginTop: 16,
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: 14,
    color: '#95a5a6',
    marginTop: 8,
    textAlign: 'center',
  },
});

export default HistorialPrestamosScreen;