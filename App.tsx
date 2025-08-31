import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  SafeAreaView,
  Pressable,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ALERT_TYPE, AlertNotificationRoot, Dialog, Toast } from 'react-native-alert-notification';

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

  // Load expenses from AsyncStorage
  const loadExpenses = async () => {
    try {
      const saved = await AsyncStorage.getItem('@expenses');
      if (saved) {
        setExpenses(JSON.parse(saved));
      }
    } catch (error) {
      console.log('Error loading expenses:', error);
    }
  };

  // Save expenses to AsyncStorage
  const saveToStorage = async (newExpenses: Expense[]) => {
    try {
      await AsyncStorage.setItem('@expenses', JSON.stringify(newExpenses));
    } catch (error) {
      console.log('Error saving expenses:', error);
    }
  };

  // Save expense to backend database
  const saveToDatabase = async (expense: Expense) => {
    try {
      const response = await fetch(BACKEND_URL + "/ExpenseTracker/SaveExpenses", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: expense.id,
          title: expense.title,
          amount: expense.amount,
          category: expense.category,
          date: expense.date,
          user: "1",
        }),
      });

      const result = await response.json();
      if (result.status) {
        console.log('Saved to database successfully');
      } else {
        console.log('Database save failed');
      }
    } catch (error) {
      console.log('Error connecting to database:', error);
    }
  };

  // Add new expense
  const addExpense = async () => {
    // Check if fields are filled
    if (!title.trim() || !amount.trim()) {
      Toast.show({
        type: ALERT_TYPE.DANGER,
        title: 'Error',
        textBody: 'Please fill in all fields',
      });
      return;
    }

    // Check if amount is valid number
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      Toast.show({
        type: ALERT_TYPE.DANGER,
        title: 'Error',
        textBody: 'Please enter a valid amount',
      });
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

    // Add to list
    const updatedExpenses = [newExpense, ...expenses];
    setExpenses(updatedExpenses);

    // Save to phone storage
    await saveToStorage(updatedExpenses);

    // Save to database
    await saveToDatabase(newExpense);

    // Clear form
    setTitle('');
    setAmount('');
    setCategory('Food');

    Toast.show({
      type: ALERT_TYPE.SUCCESS,
      title: 'Success',
      textBody: 'Expense added!',
    });
  };

  // Delete expense
  const deleteExpense = (id: string) => {
    Dialog.show({
      type: ALERT_TYPE.DANGER,
      title: "Delete Expense",
      textBody: "Are you sure you want to delete this expense?",
      button: "Delete",
      closeOnOverlayTap: true,
      onPressButton: async () => {
        // Remove from list
        const updatedExpenses = expenses.filter(exp => exp.id !== id);
        setExpenses(updatedExpenses);

        // Save to phone storage
        await saveToStorage(updatedExpenses);

        // Delete from database
        try {
          await fetch(BACKEND_URL + "/ExpenseTracker/DeleteExpenses?id=" + id, {
            method: "DELETE",
          });
        } catch (error) {
          console.log('Error deleting from database:', error);
        }

        Toast.show({
          type: ALERT_TYPE.SUCCESS,
          title: 'Success',
          textBody: 'Expense deleted!',
        });

        Dialog.hide();
      },
    });
  };

  // Calculate total amount
  const totalAmount = expenses.reduce((sum, expense) => sum + expense.amount, 0);

  // Render each expense item
  const renderExpense = ({ item }: { item: Expense }) => (
    <TouchableOpacity
      style={styles.expenseCard}
      onLongPress={() => deleteExpense(item.id)}
    >
      <View style={styles.expenseHeader}>
        <Text style={styles.expenseTitle}>{item.title}</Text>
        <Text style={styles.expenseAmount}>Rs.{item.amount.toFixed(2)}</Text>
      </View>
      <View style={styles.expenseFooter}>
        <Text style={styles.expenseCategory}>{item.category}</Text>
        <Text style={styles.expenseDate}>{item.date}</Text>
      </View>
    </TouchableOpacity>
  );

  // Render category buttons
  const renderCategoryButton = (cat: string) => (
    <TouchableOpacity
      key={cat}
      style={[
        styles.categoryButton,
        category === cat && styles.categoryButtonActive
      ]}
      onPress={() => setCategory(cat)}
    >
      <Text style={[
        styles.categoryText,
        category === cat && styles.categoryTextActive
      ]}>
        {cat}
      </Text>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={{ flex: 1 }}>
      <AlertNotificationRoot>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Expense Tracker</Text>
            <View style={styles.totalContainer}>
              <Text style={styles.totalLabel}>Total Spent</Text>
              <Text style={styles.totalAmount}>Rs {totalAmount.toFixed(2)}</Text>
            </View>
          </View>

          {/* Add Expense Form */}
          <View style={styles.formContainer}>
            <Text style={styles.sectionTitle}>Add New Expense</Text>

            <TextInput
              style={styles.input}
              placeholder="What did you buy?"
              placeholderTextColor="#9ca3af"
              value={title}
              onChangeText={setTitle}
            />

            <TextInput
              style={styles.input}
              placeholder="0.00"
              placeholderTextColor="#9ca3af"
              value={amount}
              onChangeText={setAmount}
              keyboardType="numeric"
            />

            <View style={styles.categoriesContainer}>
              <Text style={styles.categoryLabel}>Category:</Text>
              <View style={styles.categoryButtons}>
                {categories.map(renderCategoryButton)}
              </View>
            </View>

            <Pressable style={styles.addButton} onPress={addExpense}>
              <Text style={styles.addButtonText}>Add Expense</Text>
            </Pressable>
          </View>

          {/* Expenses List */}
          <View style={styles.listContainer}>
            <Text style={styles.sectionTitle}>Recent Expenses</Text>
            {expenses.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyText}>No expenses yet</Text>
                <Text style={styles.emptySubtext}>Add your first expense above</Text>
              </View>
            ) : (
              <FlatList
                data={expenses}
                renderItem={renderExpense}
                keyExtractor={item => item.id}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.listContent}
              />
            )}
          </View>
        </View>
      </AlertNotificationRoot>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    backgroundColor: '#6366f1',
    paddingTop: 50,
    paddingBottom: 30,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 25,
    borderBottomRightRadius: 25,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: 'white',
    textAlign: 'center',
    marginBottom: 15,
  },
  totalContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 15,
    padding: 15,
    alignItems: 'center',
  },
  totalLabel: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 14,
    marginBottom: 5,
  },
  totalAmount: {
    color: 'white',
    fontSize: 24,
    fontWeight: 'bold',
  },
  formContainer: {
    backgroundColor: 'white',
    margin: 20,
    padding: 20,
    borderRadius: 20,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#374151',
    marginBottom: 15,
  },
  input: {
    backgroundColor: '#f3f4f6',
    borderRadius: 12,
    padding: 15,
    fontSize: 16,
    marginBottom: 15,
    color: '#374151',
  },
  categoriesContainer: {
    marginBottom: 20,
  },
  categoryLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 10,
  },
  categoryButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  categoryButton: {
    backgroundColor: '#e5e7eb',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  categoryButtonActive: {
    backgroundColor: '#6366f1',
  },
  categoryText: {
    color: '#374151',
    fontSize: 14,
    fontWeight: '500',
  },
  categoryTextActive: {
    color: 'white',
  },
  addButton: {
    backgroundColor: '#10b981',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  addButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  listContainer: {
    flex: 1,
    paddingHorizontal: 20,
  },
  listContent: {
    paddingBottom: 20,
  },
  emptyState: {
    alignItems: 'center',
    marginTop: 50,
  },
  emptyText: {
    fontSize: 18,
    color: '#9ca3af',
    fontWeight: '500',
  },
  emptySubtext: {
    fontSize: 14,
    color: '#d1d5db',
    marginTop: 5,
  },
  expenseCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  expenseHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  expenseTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    flex: 1,
  },
  expenseAmount: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#ef4444',
  },
  expenseFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  expenseCategory: {
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    fontSize: 12,
    color: '#6b7280',
    fontWeight: '500',
  },
  expenseDate: {
    fontSize: 12,
    color: '#9ca3af',
  },
});