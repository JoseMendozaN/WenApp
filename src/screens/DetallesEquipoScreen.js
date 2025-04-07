import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { supabase } from '../lib/supabase';
import { useRoute } from '@react-navigation/native';

const DetallesEquipoScreen = () => {
  const route = useRoute();
  const [equipo, setEquipo] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // Obtiene el ID del equipo de los parámetros de navegación
  const { equipoId } = route.params;

  useEffect(() => {
    const cargarEquipo = async () => {
      try {
        const { data, error } = await supabase
          .from('equipos')
          .select(`
            idequipo,
            nombreequipo,
            estado,
            descripcion,
            fechacreacion,
            categoriasequipos: idcategoria (nombrecategoria)
          `)
          .eq('idequipo', equipoId)
          .single();

        if (error) throw error;
        
        setEquipo(data);
      } catch (error) {
        console.error('Error al cargar equipo:', error);
      } finally {
        setLoading(false);
      }
    };

    cargarEquipo();
  }, [equipoId]);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (!equipo) {
    return (
      <View style={styles.container}>
        <Text>No se encontró el equipo</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{equipo.nombreequipo}</Text>
      <Text style={styles.subtitle}>Categoría: {equipo.categoriasequipos?.nombrecategoria}</Text>
      <Text>Estado: {equipo.estado}</Text>
      {equipo.descripcion && <Text>Descripción: {equipo.descripcion}</Text>}
      <Text>Fecha de creación: {new Date(equipo.fechacreacion).toLocaleDateString()}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 18,
    marginBottom: 10,
  },
});

export default DetallesEquipoScreen;