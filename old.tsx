import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  Alert,
  StatusBar,
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
  synced?: boolean;
  backendId?: number;
}

const STORAGE_KEY = '@expense_tracker';

export default function App() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('Food');
  const [isOnline, setIsOnline] = useState(true);
  const [isLoading, setIsLoading] = useState(false);

  const categories = ['Food', 'Transport', 'Shopping', 'Bills', 'Healthcare', 'Other'];

  useEffect(() => {
    loadExpenses();
    checkNetworkStatus();
  }, []);

  const checkNetworkStatus = async () => {
    try {
      // Create a timeout promise
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Request timeout')), 5000)
      );
      
      // Create the fetch promise
      const fetchPromise = fetch(BACKEND_URL + "/ExpenseTracker/LoadExpenses", {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      });
      
      // Race between fetch and timeout
      const response = await Promise.race([fetchPromise, timeoutPromise]) as Response;
      setIsOnline(response.ok);
    } catch (error) {
      setIsOnline(false);
      console.log('Network check failed, switching to offline mode');
    }
  };

  const loadExpenses = async () => {
    try {
      setIsLoading(true);
      
      if (isOnline) {
        await loadDataFromDatabase();
      } else {
        // Load from local storage when offline
        const stored = await AsyncStorage.getItem(STORAGE_KEY);
        if (stored) {
          const parsedExpenses = JSON.parse(stored);
          setExpenses(parsedExpenses);
        }
      }
    } catch (error) {
      console.error('Failed to load expenses:', error);
      Toast.show({
        type: ALERT_TYPE.WARNING,
        title: 'Loading Failed',
        textBody: 'Could not load expenses. Using local data.',
      });
      
      // Fallback to local storage
      try {
        const stored = await AsyncStorage.getItem(STORAGE_KEY);
        if (stored) {
          setExpenses(JSON.parse(stored));
        }
      } catch (localError) {
        console.error('Local storage also failed:', localError);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const loadDataFromDatabase = async () => {
    try {
      const response = await fetch(
        BACKEND_URL + "/ExpenseTracker/LoadExpenses",
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      if (response.ok) {
        const json = await response.json();

        if (json.status && json.expenseList) {
          // Mark all expenses from backend as synced
          const syncedExpenses = json.expenseList.map((expense: any) => ({
            ...expense,
            synced: true,
          }));
          setExpenses(syncedExpenses);
          
          // Also save to local storage as backup
          await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(syncedExpenses));
        } else {
          Toast.show({
            type: ALERT_TYPE.WARNING,
            title: 'Server Error',
            textBody: 'Failed to load expenses from server',
          });
        }
      } else {
        Toast.show({
          type: ALERT_TYPE.DANGER,
          title: 'Network Error',
          textBody: 'Could not connect to server',
        });
        setIsOnline(false);
      }
    } catch (error) {
      console.error('Database load error:', error);
      Toast.show({
        type: ALERT_TYPE.DANGER,
        title: 'Connection Error',
        textBody: 'Failed to connect to server',
      });
      setIsOnline(false);
      throw error; // Re-throw to trigger fallback in loadExpenses
    }
  };

  const saveExpenses = async (newExpenses: Expense[]) => {
    try {
      // Always save to local storage first
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(newExpenses));

      // Try to sync with backend if online
      if (isOnline) {
        await syncWithBackend(newExpenses);
      }
    } catch (error) {
      console.error('Failed to save expenses:', error);
      Toast.show({
        type: ALERT_TYPE.DANGER,
        title: 'Save Error',
        textBody: 'Failed to save expense locally',
      });
    }
  };

  const syncWithBackend = async (expensesToSync: Expense[]) => {
    try {
      // Filter out expenses that are already synced
      const unsyncedExpenses = expensesToSync.filter(exp => !exp.synced);

      if (unsyncedExpenses.length === 0) {
        return; // Nothing to sync
      }

      for (const expense of unsyncedExpenses) {
        await saveExpenseToBackend(expense);
      }

      // After sync, reload from backend to get updated data with backend IDs
      await loadDataFromDatabase();
    } catch (error) {
      console.error('Sync failed:', error);
      Toast.show({
        type: ALERT_TYPE.WARNING,
        title: 'Sync Failed',
        textBody: 'Could not sync with server. Data saved locally.',
      });
    }
  };

  const saveExpenseToBackend = async (expense: Expense) => {
    try {
      const response = await fetch(
        BACKEND_URL + "/ExpenseTracker/SaveExpenses",
        {
          method: "POST",
          body: JSON.stringify({
            id: expense.id,
            title: expense.title,
            amount: expense.amount,
            category: expense.category,
            date: expense.date,
            user: "1",
          }),
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      if (response.ok) {
        const json = await response.json();
        if (json.status) {
          // Mark as synced in local state
          const updatedExpenses = expenses.map(exp => 
            exp.id === expense.id ? { ...exp, synced: true, backendId: json.id } : exp
          );
          setExpenses(updatedExpenses);
          await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updatedExpenses));
        } else {
          Toast.show({
            type: ALERT_TYPE.DANGER,
            title: 'Server Error',
            textBody: json.message || 'Failed to save to server',
          });
        }
      } else {
        Toast.show({
          type: ALERT_TYPE.DANGER,
          title: 'Network Error',
          textBody: 'Could not connect to server',
        });
        setIsOnline(false);
      }
    } catch (error) {
      console.error('Backend save error:', error);
      Toast.show({
        type: ALERT_TYPE.DANGER,
        title: 'Connection Error',
        textBody: 'Failed to connect to server',
      });
      setIsOnline(false);
      throw error;
    }
  };

  const addExpense = async () => {
    if (!title.trim() || !amount.trim()) {
      Toast.show({
        type: ALERT_TYPE.DANGER,
        title: 'Error',
        textBody: 'Please fill in all fields',
      });
      return;
    }

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      Toast.show({
        type: ALERT_TYPE.DANGER,
        title: 'Error',
        textBody: 'Please enter a valid amount greater than 0',
      });
      return;
    }

    const tmpId = `tmp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const newExpense: Expense = {
      id: tmpId,
      title: title.trim(),
      amount: numAmount,
      category,
      date: new Date().toLocaleDateString(),
      synced: false, // Always start as unsynced, will be marked as synced after successful backend save
    };

    const updatedExpenses = [newExpense, ...expenses];
    setExpenses(updatedExpenses);
    
    // Save to local storage and attempt backend sync
    await saveExpenses(updatedExpenses);

    // Clear form
    setTitle('');
    setAmount('');
    setCategory('Food');

    Toast.show({
      type: ALERT_TYPE.SUCCESS,
      title: 'Success',
      textBody: 'Expense added successfully',
    });
  };

  const deleteExpense = (id: string) => {
    const expenseToDelete = expenses.find(exp => exp.id === id);
    
    Dialog.show({
      type: ALERT_TYPE.DANGER,
      title: "Delete Expense",
      textBody: "Are you sure you want to delete this expense?",
      button: "Delete",
      closeOnOverlayTap: true,
      onPressButton: async () => {
        try {
          const updatedExpenses = expenses.filter(exp => exp.id !== id);
          setExpenses(updatedExpenses);
          
          if (isOnline && expenseToDelete?.synced) {
            // If expense was synced to backend, delete from backend
            const deleteId = expenseToDelete.backendId || id;
            const response = await fetch(
              BACKEND_URL + "/ExpenseTracker/DeleteExpenses?id=" + deleteId,
              {
                method: "DELETE",
                headers: {
                  "Content-Type": "application/json",
                },
              }
            );
            
            if (response.ok) {
              const json = await response.json();
              if (json.status) {
                Toast.show({
                  type: ALERT_TYPE.SUCCESS,
                  title: 'Success',
                  textBody: 'Expense deleted successfully',
                });
                // Reload from database to ensure consistency
                await loadDataFromDatabase();
              } else {
                Toast.show({
                  type: ALERT_TYPE.WARNING,
                  title: 'Partial Success',
                  textBody: 'Deleted locally, but server delete failed',
                });
              }
            } else {
              Toast.show({
                type: ALERT_TYPE.WARNING,
                title: 'Network Error',
                textBody: 'Deleted locally, could not sync with server',
              });
            }
          } else {
            // Just save the updated list locally
            await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updatedExpenses));
            Toast.show({
              type: ALERT_TYPE.SUCCESS,
              title: 'Success',
              textBody: 'Expense deleted successfully',
            });
          }
        } catch (err) {
          console.error("Delete failed", err);
          Toast.show({
            type: ALERT_TYPE.DANGER,
            title: 'Delete Failed',
            textBody: 'Could not delete expense',
          });
        } finally {
          Dialog.hide();
        }
      },
    });
  };

  const retrySync = async () => {
    if (!isOnline) {
      await checkNetworkStatus();
    }
    
    if (isOnline) {
      try {
        await syncWithBackend(expenses);
        Toast.show({
          type: ALERT_TYPE.SUCCESS,
          title: 'Sync Complete',
          textBody: 'All expenses synced with server',
        });
      } catch (error) {
        Toast.show({
          type: ALERT_TYPE.DANGER,
          title: 'Sync Failed',
          textBody: 'Could not sync with server',
        });
      }
    } else {
      Toast.show({
        type: ALERT_TYPE.WARNING,
        title: 'Offline',
        textBody: 'No internet connection available',
      });
    }
  };

  const totalAmount = expenses.reduce((sum, expense) => sum + expense.amount, 0);
  const unsyncedCount = expenses.filter(exp => !exp.synced).length;

  const renderExpense = ({ item }: { item: Expense }) => (
    <TouchableOpacity
      style={[
        styles.expenseCard,
        !item.synced && styles.unsyncedCard
      ]}
      onLongPress={() => deleteExpense(item.id)}
    >
      <View style={styles.expenseHeader}>
        <Text style={styles.expenseTitle}>{item.title}</Text>
        <Text style={styles.expenseAmount}>Rs.{item.amount.toFixed(2)}</Text>
      </View>
      <View style={styles.expenseFooter}>
        <Text style={styles.expenseCategory}>{item.category}</Text>
        <View style={styles.rightFooter}>
          <Text style={styles.expenseDate}>{item.date}</Text>
          {!item.synced && (
            <View style={styles.unsyncedIndicator}>
              <Text style={styles.unsyncedText}>●</Text>
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );

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
          <StatusBar barStyle="light-content" backgroundColor="#6366f1" />

          <View style={styles.header}>
            <View style={styles.headerTop}>
              <Text style={styles.headerTitle}>Expense Tracker</Text>
              <View style={styles.statusContainer}>
                <View style={[
                  styles.statusIndicator,
                  { backgroundColor: isOnline ? '#10b981' : '#ef4444' }
                ]} />
                <Text style={styles.statusText}>
                  {isOnline ? 'Online' : 'Offline'}
                </Text>
              </View>
            </View>
            
            <View style={styles.totalContainer}>
              <Text style={styles.totalLabel}>Total Spent</Text>
              <Text style={styles.totalAmount}>Rs {totalAmount.toFixed(2)}</Text>
              {unsyncedCount > 0 && (
                <TouchableOpacity style={styles.syncButton} onPress={retrySync}>
                  <Text style={styles.syncButtonText}>
                    {unsyncedCount} unsynced - Tap to sync
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </View>

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

            <Pressable 
              style={[styles.addButton, isLoading && styles.addButtonDisabled]} 
              onPress={addExpense}
              disabled={isLoading}
            >
              <Text style={styles.addButtonText}>
                {isLoading ? 'Adding...' : 'Add Expense'}
              </Text>
            </Pressable>
          </View>

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
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: 'white',
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  statusText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '500',
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
  syncButton: {
    marginTop: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  syncButtonText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '500',
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
  addButtonDisabled: {
    backgroundColor: '#9ca3af',
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
  unsyncedCard: {
    borderLeftWidth: 4,
    borderLeftColor: '#f59e0b',
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
  rightFooter: {
    flexDirection: 'row',
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
    marginRight: 8,
  },
  unsyncedIndicator: {
    width: 12,
    height: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  unsyncedText: {
    color: '#f59e0b',
    fontSize: 16,
    fontWeight: 'bold',
  },
});