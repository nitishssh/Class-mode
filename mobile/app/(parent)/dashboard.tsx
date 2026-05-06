import { View, Text, FlatList } from 'react-native';
import { useQuery } from '@tanstack/react-query';

export default function ParentDashboard() {
  const { data } = useQuery({
    queryKey: ['/api/parent/dashboard'],
    queryFn: async () => {
      const res = await fetch('/api/parent/dashboard');
      return res.json();
    },
  });

  const children = data?.data?.children || [];

  return (
    <View style={{ flex: 1, padding: 16, backgroundColor: '#F9FAFB' }}>
      <Text style={{ fontSize: 24, fontWeight: 'bold', marginBottom: 16 }}>Parent Dashboard</Text>
      {children.map((child: any) => (
        <View key={child.id} style={{ padding: 16, backgroundColor: 'white', borderRadius: 8, marginBottom: 8 }}>
          <Text style={{ fontSize: 18, fontWeight: '600' }}>{child.name}</Text>
          <Text style={{ color: '#6B7280' }}>{child.class} • {child.grade}</Text>
        </View>
      ))}
    </View>
  );
}
