import { View, Text, FlatList, Pressable } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';

export default function EducatorDashboard() {
  const { data } = useQuery({
    queryKey: ['/api/educator/dashboard'],
    queryFn: async () => {
      const res = await fetch('/api/educator/dashboard');
      return res.json();
    },
  });

  const stats = data?.data?.stats || {};

  return (
    <View style={{ flex: 1, padding: 16, backgroundColor: '#F9FAFB' }}>
      <Text style={{ fontSize: 24, fontWeight: 'bold', marginBottom: 16 }}>Educator Dashboard</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
        <View style={{ flex: 1, minWidth: 150, padding: 16, backgroundColor: 'white', borderRadius: 8 }}>
          <Text style={{ fontSize: 14, color: '#6B7280' }}>Students</Text>
          <Text style={{ fontSize: 28, fontWeight: 'bold' }}>{stats.totalStudents || 0}</Text>
        </View>
        <View style={{ flex: 1, minWidth: 150, padding: 16, backgroundColor: 'white', borderRadius: 8 }}>
          <Text style={{ fontSize: 14, color: '#6B7280' }}>Tests</Text>
          <Text style={{ fontSize: 28, fontWeight: 'bold' }}>{stats.totalTests || 0}</Text>
        </View>
        <View style={{ flex: 1, minWidth: 150, padding: 16, backgroundColor: 'white', borderRadius: 8 }}>
          <Text style={{ fontSize: 14, color: '#6B7280' }}>Pending Grading</Text>
          <Text style={{ fontSize: 28, fontWeight: 'bold' }}>{stats.pendingGrading || 0}</Text>
        </View>
      </View>
    </View>
  );
}
