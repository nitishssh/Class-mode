import { View, Text, ScrollView, Pressable, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { LineChart, BarChart, PieChart } from 'react-native-chart-kit';

export default function AnalyticsScreen() {
  const router = useRouter();
  const screenWidth = Dimensions.get('window').width;

  const kpis = [
    {
      label: 'Overall Score',
      value: '85%',
      trend: '+5%',
      trendUp: true,
      icon: 'trending-up',
      color: '#10B981',
      bgColor: '#D1FAE5',
    },
    {
      label: 'Tests Completed',
      value: '24',
      trend: '+3',
      trendUp: true,
      icon: 'checkmark-circle',
      color: '#3B82F6',
      bgColor: '#DBEAFE',
    },
    {
      label: 'Study Streak',
      value: '7 days',
      trend: 'Active',
      trendUp: true,
      icon: 'flame',
      color: '#F59E0B',
      bgColor: '#FEF3C7',
    },
    {
      label: 'Rank',
      value: '#12',
      trend: '+3',
      trendUp: true,
      icon: 'trophy',
      color: '#8B5CF6',
      bgColor: '#EDE9FE',
    },
  ];

  const performanceData = {
    labels: ['Math', 'Physics', 'Chem', 'Bio', 'Eng'],
    datasets: [
      {
        data: [85, 78, 92, 88, 75],
        color: (opacity = 1) => `rgba(59, 130, 246, ${opacity})`,
        strokeWidth: 2,
      },
    ],
  };

  const progressData = {
    labels: ['Week 1', 'Week 2', 'Week 3', 'Week 4'],
    datasets: [
      {
        data: [65, 72, 78, 85],
      },
    ],
  };

  const completionData = [
    {
      name: 'Completed',
      population: 85,
      color: '#10B981',
      legendFontColor: '#374151',
    },
    {
      name: 'In Progress',
      population: 10,
      color: '#F59E0B',
      legendFontColor: '#374151',
    },
    {
      name: 'Not Started',
      population: 5,
      color: '#EF4444',
      legendFontColor: '#374151',
    },
  ];

  const chartConfig = {
    backgroundGradientFrom: '#ffffff',
    backgroundGradientTo: '#ffffff',
    color: (opacity = 1) => `rgba(59, 130, 246, ${opacity})`,
    strokeWidth: 2,
    barPercentage: 0.7,
    useShadowColorFromDataset: false,
    decimalPlaces: 0,
  };

  return (
    <View className="flex-1 bg-gray-50">
      {/* Header */}
      <View className="bg-white px-6 py-4 border-b border-gray-200">
        <View className="flex-row items-center justify-between">
          <Pressable onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color="#374151" />
          </Pressable>
          <Text className="text-xl font-bold text-gray-900">Analytics</Text>
          <Pressable>
            <Ionicons name="filter" size={24} color="#3B82F6" />
          </Pressable>
        </View>
      </View>

      <ScrollView className="flex-1">
        <View className="p-6">
          {/* KPI Cards */}
          <View className="flex-row flex-wrap gap-3 mb-6">
            {kpis.map((kpi, index) => (
              <View
                key={index}
                className="flex-1 min-w-[45%] bg-white rounded-xl p-4 shadow-sm"
              >
                <View className="flex-row items-center justify-between mb-2">
                  <View
                    className="w-10 h-10 rounded-full items-center justify-center"
                    style={{ backgroundColor: kpi.bgColor }}
                  >
                    <Ionicons name={kpi.icon as any} size={20} color={kpi.color} />
                  </View>
                  <View
                    className={`flex-row items-center ${
                      kpi.trendUp ? 'text-green-600' : 'text-red-600'
                    }`}
                  >
                    <Ionicons
                      name={kpi.trendUp ? 'arrow-up' : 'arrow-down'}
                      size={12}
                      color={kpi.trendUp ? '#10B981' : '#EF4444'}
                    />
                    <Text
                      className="text-xs font-semibold ml-1"
                      style={{ color: kpi.trendUp ? '#10B981' : '#EF4444' }}
                    >
                      {kpi.trend}
                    </Text>
                  </View>
                </View>
                <Text className="text-2xl font-bold text-gray-900">{kpi.value}</Text>
                <Text className="text-xs text-gray-600 mt-1">{kpi.label}</Text>
              </View>
            ))}
          </View>

          {/* Performance by Subject */}
          <View className="bg-white rounded-xl p-4 shadow-sm mb-6">
            <View className="flex-row items-center mb-4">
              <View className="w-8 h-8 rounded-lg bg-blue-100 items-center justify-center mr-2">
                <Ionicons name="bar-chart" size={16} color="#3B82F6" />
              </View>
              <Text className="text-base font-semibold text-gray-900">
                Performance by Subject
              </Text>
            </View>
            <BarChart
              data={performanceData}
              width={screenWidth - 80}
              height={220}
              chartConfig={chartConfig}
              style={{
                marginVertical: 8,
                borderRadius: 16,
              }}
              showValuesOnTopOfBars
              fromZero
            />
          </View>

          {/* Progress Over Time */}
          <View className="bg-white rounded-xl p-4 shadow-sm mb-6">
            <View className="flex-row items-center mb-4">
              <View className="w-8 h-8 rounded-lg bg-green-100 items-center justify-center mr-2">
                <Ionicons name="trending-up" size={16} color="#10B981" />
              </View>
              <Text className="text-base font-semibold text-gray-900">
                Progress Over Time
              </Text>
            </View>
            <LineChart
              data={progressData}
              width={screenWidth - 80}
              height={220}
              chartConfig={{
                ...chartConfig,
                color: (opacity = 1) => `rgba(16, 185, 129, ${opacity})`,
              }}
              bezier
              style={{
                marginVertical: 8,
                borderRadius: 16,
              }}
            />
          </View>

          {/* Test Completion Rate */}
          <View className="bg-white rounded-xl p-4 shadow-sm mb-6">
            <View className="flex-row items-center mb-4">
              <View className="w-8 h-8 rounded-lg bg-purple-100 items-center justify-center mr-2">
                <Ionicons name="pie-chart" size={16} color="#8B5CF6" />
              </View>
              <Text className="text-base font-semibold text-gray-900">
                Test Completion Rate
              </Text>
            </View>
            <PieChart
              data={completionData}
              width={screenWidth - 80}
              height={200}
              chartConfig={chartConfig}
              accessor="population"
              backgroundColor="transparent"
              paddingLeft="15"
              absolute
            />
          </View>

          {/* Insights Card */}
          <View className="bg-gradient-to-r from-primary-600 to-primary-700 rounded-xl p-6 shadow-lg">
            <View className="flex-row items-center mb-3">
              <Ionicons name="bulb" size={24} color="white" />
              <Text className="text-white font-bold text-lg ml-2">
                AI Insights
              </Text>
            </View>
            <Text className="text-white/90 text-sm leading-relaxed mb-4">
              You're performing exceptionally well in Chemistry! Consider spending
              more time on English to improve your overall score.
            </Text>
            <Pressable className="bg-white/20 rounded-lg py-2 px-4 self-start">
              <Text className="text-white font-semibold text-sm">
                View Recommendations
              </Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
