import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  SafeAreaView,
  Alert,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const BACKEND_URL = "https://945f7c53c314.ngrok-free.app";

interface Expense {
  id: string;
  title: string;
  amount: number;
  category: string;
  date: string;
}

export default function App() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('Food');

  const categories = ['Food', 'Transport', 'Shopping', 'Bills', 'Healthcare', 'Other'];

  // Load expenses when app starts
  useEffect(() => {
    loadExpenses();
  }, []);

  // Load expenses from AsyncStorage first, then try to get from backend
  const loadExpenses = async () => {
    try {
      // First, load from local storage (always works)
      const stored = await AsyncStorage.getItem('expenses');
      if (stored) {
        setExpenses(JSON.parse(stored));
      }

      // Then try to load from backend (might fail if offline)
      await loadFromBackend();
    } catch (error) {
      console.log('Error loading expenses:', error);
    }
  };

  // Get expenses from backend database
  const loadFromBackend = async () => {
    try {
      const response = await fetch(BACKEND_URL + "/ExpenseTracker/LoadExpenses");
      const data = await response.json();
      
      if (data.status && data.expenseList) {
        setExpenses(data.expenseList);
        // Save to local storage as backup
        await AsyncStorage.setItem('expenses', JSON.stringify(data.expenseList));
      }
    } catch (error) {
      console.log('Backend not available, using local data');
    }
  };

  // Save expense to both local storage and backend
  const saveExpense = async (newExpense: Expense) => {
    try {
      // Always save to local storage first
      const updatedExpenses = [newExpense, ...expenses];
      setExpenses(updatedExpenses);
      await AsyncStorage.setItem('expenses', JSON.stringify(updatedExpenses));

      // Try to save to backend
      await fetch(BACKEND_URL + "/ExpenseTracker/SaveExpenses", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: newExpense.id,
          title: newExpense.title,
          amount: newExpense.amount,
          category: newExpense.category,
          date: newExpense.date,
          user: "1",
        }),
      });
      
      Alert.alert('Success', 'Expense added successfully!');
    } catch (error) {
      console.log('Backend save failed, but saved locally');
      Alert.alert('Saved Locally', 'Expense saved to your device');
    }
  };

  // Add new expense
  const addExpense = () => {
    // Check if fields are filled
    if (!title.trim() || !amount.trim()) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    // Check if amount is valid
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      Alert.alert('Error', 'Please enter a valid amount');
      return;
    }

    // Create new expense
    const newExpense: Expense = {
      id: Date.now().toString(),
      title: title.trim(),
      amount: numAmount,
      category: category,
      date: new Date().toLocaleDateString(),
    };

    // Save the expense
    saveExpense(newExpense);

    // Clear the form
    setTitle('');
    setAmount('');
    setCategory('Food');
  };

  // Delete expense
  const deleteExpense = async (id: string) => {
    Alert.alert(
      'Delete Expense',
      'Are you sure you want to delete this expense?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              // Remove from local list
              const updatedExpenses = expenses.filter(exp => exp.id !== id);
              setExpenses(updatedExpenses);
              await AsyncStorage.setItem('expenses', JSON.stringify(updatedExpenses));

              // Try to delete from backend
              await fetch(BACKEND_URL + `/ExpenseTracker/DeleteExpenses?id=${id}`, {
                method: "DELETE",
              });

              Alert.alert('Success', 'Expense deleted');
            } catch (error) {
              console.log('Delete error:', error);
              Alert.alert('Deleted Locally', 'Expense removed from your device');
            }
          },
        },
      ]
    );
  };

  // Calculate total amount
  const totalAmount = expenses.reduce((sum, expense) => sum + expense.amount, 0);

  // Render each expense item
  const renderExpense = ({ item }: { item: Expense }) => (
    <TouchableOpacity style={styles.expenseCard} onLongPress={() => deleteExpense(item.id)}>
      <View style={styles.expenseRow}>
        <Text style={styles.expenseTitle}>{item.title}</Text>
        <Text style={styles.expenseAmount}>Rs.{item.amount.toFixed(2)}</Text>
      </View>
      <View style={styles.expenseRow}>
        <Text style={styles.expenseCategory}>{item.category}</Text>
        <Text style={styles.expenseDate}>{item.date}</Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Expense Tracker</Text>
        <Text style={styles.totalAmount}>Total: Rs {totalAmount.toFixed(2)}</Text>
      </View>

      {/* Add Expense Form */}
      <View style={styles.form}>
        <Text style={styles.formTitle}>Add New Expense</Text>

        <TextInput
          style={styles.input}
          placeholder="What did you buy?"
          value={title}
          onChangeText={setTitle}
        />

        <TextInput
          style={styles.input}
          placeholder="How much did it cost?"
          value={amount}
          onChangeText={setAmount}
          keyboardType="numeric"
        />

        <Text style={styles.label}>Category:</Text>
        <View style={styles.categories}>
          {categories.map((cat) => (
            <TouchableOpacity
              key={cat}
              style={[
                styles.categoryButton,
                category === cat && styles.selectedCategory
              ]}
              onPress={() => setCategory(cat)}
            >
              <Text style={[
                styles.categoryText,
                category === cat && styles.selectedCategoryText
              ]}>
                {cat}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity style={styles.addButton} onPress={addExpense}>
          <Text style={styles.addButtonText}>Add Expense</Text>
        </TouchableOpacity>
      </View>

      {/* Expenses List */}
      <View style={styles.listContainer}>
        <Text style={styles.listTitle}>Your Expenses</Text>
        {expenses.length === 0 ? (
          <Text style={styles.emptyText}>No expenses yet. Add one above!</Text>
        ) : (
          <FlatList
            data={expenses}
            renderItem={renderExpense}
            keyExtractor={item => item.id}
            style={styles.list}
          />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    backgroundColor: '#4CAF50',
    padding: 20,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 10,
  },
  totalAmount: {
    fontSize: 18,
    color: 'white',
    fontWeight: '600',
  },
  form: {
    backgroundColor: 'white',
    margin: 15,
    padding: 20,
    borderRadius: 10,
  },
  formTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15,
    color: '#333',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 15,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 10,
    color: '#333',
  },
  categories: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 20,
  },
  categoryButton: {
    backgroundColor: '#e0e0e0',
    padding: 10,
    borderRadius: 20,
    margin: 5,
  },
  selectedCategory: {
    backgroundColor: '#4CAF50',
  },
  categoryText: {
    color: '#333',
  },
  selectedCategoryText: {
    color: 'white',
  },
  addButton: {
    backgroundColor: '#2196F3',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  addButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  listContainer: {
    flex: 1,
    margin: 15,
  },
  listTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#333',
  },
  list: {
    flex: 1,
  },
  emptyText: {
    textAlign: 'center',
    color: '#666',
    fontSize: 16,
    marginTop: 50,
  },
  expenseCard: {
    backgroundColor: 'white',
    padding: 15,
    borderRadius: 8,
    marginBottom: 10,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  expenseRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 5,
  },
  expenseTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    flex: 1,
  },
  expenseAmount: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#F44336',
  },
  expenseCategory: {
    backgroundColor: '#e0e0e0',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 10,
    fontSize: 12,
    color: '#666',
  },
  expenseDate: {
    fontSize: 12,
    color: '#999',
  },
});