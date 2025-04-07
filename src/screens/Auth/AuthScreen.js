// screens/Auth/AuthScreen.js
import { useEffect, useState } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { supabase } from '../../lib/supabase';
import { getCurrentSession } from '../../lib/supabase';

export default function AuthScreen({ navigation }) {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const session = await getCurrentSession();
        if (session) {
          const { data: user, error } = await supabase
            .from('usuarios')
            .select('rol')
            .eq('idusuario', session.user.id)
            .single();

          if (!error && user) {
            // SOLUCIÓN 1: Navegación directa a los navigators padres
            navigation.replace(user.rol === 'admin' ? 'AdminArea' : 'UserArea');
            
            // O SOLUCIÓN 2: Navegación anidada explícita (descomenta una opción)
            // navigation.reset({
            //   index: 0,
            //   routes: [{
            //     name: user.rol === 'admin' ? 'AdminArea' : 'UserArea',
            //     state: {
            //       routes: [{
            //         name: user.rol === 'admin' ? 'PrincipalAdmin' : 'SolicitarPrestamo'
            //       }]
            //     }
            //   }]
            // });
          }
        } else {
          navigation.replace('Login');
        }
      } catch (error) {
        console.error('Error de autenticación:', error);
        navigation.replace('Login');
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, [navigation]);

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      <ActivityIndicator size="large" />
    </View>
  );
}