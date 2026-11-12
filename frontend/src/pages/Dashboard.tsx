import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api';
import { AreaChart, Area, XAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { Wallet, TrendingUp, TrendingDown, PieChart as PieIcon, Sparkles, LogOut, Plus } from 'lucide-react';

interface Transaction {
  id: number;
  amount: number | string;
  title: string;
  category: string;
  type: string;
  date: string;
}

export default function Dashboard() {
  const { logout } = useAuth();
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ title: '', amount: '', category: 'Food', type: 'EXPENSE' });
  const [aiInsight, setAiInsight] = useState<string>('');
  const [loadingAi, setLoadingAi] = useState<boolean>(false);

  const { data: transactions = [], isLoading } = useQuery<Transaction[]>({
    queryKey: ['transactions'],
    queryFn: async () => {
      const res = await api.get('/transactions');
      return res.data;
    }
  });

  const addTransaction = useMutation({
    mutationFn: async (newTx: Omit<Transaction, 'id' | 'date'>) => {
      await api.post('/transactions', newTx);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      setForm({ ...form, title: '', amount: '' });
    },
  });

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title || !form.amount) return;
    addTransaction.mutate({ ...form, amount: parseFloat(form.amount.toString()) });
  };

  const fetchAiInsight = async () => {
    setLoadingAi(true);
    try {
      // Using your existing axios 'api' instance handles the JWT token automatically
      const res = await api.get('/insights');
      setAiInsight(res.data.insight);
    } catch (error: any) {
      setAiInsight(error.response?.data?.detail || "Network error connecting to the AI module.");
    }
    setLoadingAi(false);
  };

  // Helper to safely check transaction type regardless of backend serialization
  const isIncome = (type: string) => type?.toUpperCase().includes('INCOME');
  const getAmount = (amount: any) => Number(amount) || 0;

  // 1. Dynamic KPI Calculations
  const income = transactions.filter(t => isIncome(t.type)).reduce((acc, t) => acc + getAmount(t.amount), 0);
  const expense = transactions.filter(t => !isIncome(t.type)).reduce((acc, t) => acc + getAmount(t.amount), 0);
  const balance = income - expense;

  // 2. Dynamic Pie Chart Data
  const expensesByCategory = transactions
    .filter(t => !isIncome(t.type))
    .reduce((acc: any, t) => {
      acc[t.category] = (acc[t.category] || 0) + getAmount(t.amount);
      return acc;
    }, {});

  const COLORS = ['#0284C7', '#10B981', '#0EA5E9', '#F59E0B', '#8B5CF6', '#EF4444'];
  const breakdownData = Object.keys(expensesByCategory).map((key, index) => ({
    name: key,
    value: expensesByCategory[key],
    color: COLORS[index % COLORS.length]
  }));

  // 3. Dynamic Area Chart Data
  const flowByDate = transactions.reduce((acc: any, t)=> {
    const dateStr = new Date(t.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const typeKey = isIncome(t.type) ? 'INCOME' : 'EXPENSE';
    if (!acc[dateStr]) acc[dateStr] = { date: dateStr, INCOME: 0, EXPENSE: 0 };
    acc[dateStr][typeKey] += getAmount(t.amount);
    return acc;
  }, {});
  
  const cashFlowData = Object.values(flowByDate).reverse();

  if (isLoading) return <div className="min-h-screen bg-background flex items-center justify-center">Loading...</div>;

  return (
    <div className="min-h-screen bg-background p-8 font-sans">
      <div className="flex justify-between items-center mb-8">
        <div className="flex items-center text-primary">
          <svg className="w-8 h-8 mr-2" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2L2 22h20L12 2zm0 4.5l6.5 13h-13L12 6.5z"/></svg>
          <h1 className="text-2xl font-bold text-textMain">FinSight</h1>
        </div>
        <button onClick={() => { queryClient.clear(); logout(); }} className="flex items-center text-textMuted hover:text-danger transition-colors">
          <LogOut className="w-5 h-5 mr-1" /> Logout
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
        <div className="bg-surface p-5 rounded-2xl shadow-card">
          <div className="flex items-center text-textMuted mb-2"><Wallet className="w-4 h-4 mr-2" /> <span className="text-sm font-medium">Total Balance</span></div>
          <div className="text-3xl font-bold text-textMain">${balance.toFixed(2)}</div>
        </div>
        <div className="bg-surface p-5 rounded-2xl shadow-card">
          <div className="flex items-center text-textMuted mb-2"><TrendingDown className="w-4 h-4 mr-2" /> <span className="text-sm font-medium">Total Income</span></div>
          <div className="text-3xl font-bold text-success">${income.toFixed(2)}</div>
        </div>
        <div className="bg-surface p-5 rounded-2xl shadow-card">
          <div className="flex items-center text-textMuted mb-2"><TrendingUp className="w-4 h-4 mr-2" /> <span className="text-sm font-medium">Total Expense</span></div>
          <div className="text-3xl font-bold text-danger">${expense.toFixed(2)}</div>
        </div>
        <div className="bg-surface p-5 rounded-2xl shadow-card">
          <div className="flex items-center text-textMuted mb-2"><PieIcon className="w-4 h-4 mr-2" /> <span className="text-sm font-medium">Expense Breakdown</span></div>
          <div className="h-24 w-full flex items-center justify-center">
            {breakdownData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={breakdownData} innerRadius={25} outerRadius={40} dataKey="value" stroke="none">
                    {breakdownData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                  </Pie>
                  <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <span className="text-xs text-textMuted">No expenses yet</span>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-surface p-6 rounded-2xl shadow-card flex flex-col justify-between">
          <h3 className="text-lg font-bold text-textMain mb-4">Cash Flow Overview</h3>
          <div className="h-64 mb-6">
            {cashFlowData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={cashFlowData}>
                  <defs>
                    <linearGradient id="colorIncome" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#10B981" stopOpacity={0.2}/><stop offset="95%" stopColor="#10B981" stopOpacity={0}/></linearGradient>
                    <linearGradient id="colorExpense" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#0284C7" stopOpacity={0.2}/><stop offset="95%" stopColor="#0284C7" stopOpacity={0}/></linearGradient>
                  </defs>
                  <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fontSize: 12, fill: '#64748B'}} />
                  <Tooltip cursor={{stroke: '#cbd5e1',strokeWidth: 1, strokeDasharray: '4 4'}} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: '12px' }} />
                  <Area type="monotone" name="Income" dataKey="INCOME" stroke="#10B981" strokeWidth={2} fillOpacity={1} fill="url(#colorIncome)" />
                  <Area type="monotone" name="Expense" dataKey="EXPENSE" stroke="#0284C7" strokeWidth={2} fillOpacity={1} fill="url(#colorExpense)" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="w-full h-full flex items-center justify-center text-textMuted text-sm">Add data to see cash flow</div>
            )}
          </div>
          
          <div className="border-t border-gray-100 pt-4">
            <h3 className="text-sm font-bold text-textMain mb-3">Quick Add Transaction</h3>
            <form onSubmit={handleAdd} className="flex gap-3 flex-wrap">
              <input type="text" required placeholder="Title (e.g. Salary, Coffee)" value={form.title} onChange={e => setForm({...form, title: e.target.value})} className="flex-1 min-w-[150px] px-3 py-2 border border-gray-200 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary rounded-lg text-sm transition-all" />
              <input type="number" step="0.01" required placeholder="Amount" value={form.amount} onChange={e => setForm({...form, amount: e.target.value})} className="w-24 px-3 py-2 border border-gray-200 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary rounded-lg text-sm transition-all" />
              <select value={form.category} onChange={e => setForm({...form, category: e.target.value})} className="px-3 py-2 border border-gray-200 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary rounded-lg text-sm bg-white transition-all">
                <option value="Food">Food</option>
                <option value="Transport">Transport</option>
                <option value="Housing">Housing</option>
                <option value="Salary">Salary</option>
                <option value="General">General</option>
              </select>
              <select value={form.type} onChange={e => setForm({...form, type: e.target.value})} className="px-3 py-2 border border-gray-200 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary rounded-lg text-sm bg-white transition-all">
                <option value="EXPENSE">Expense</option>
                <option value="INCOME">Income</option>
              </select>
              <button type="submit" disabled={addTransaction.isPending} className="bg-primary hover:bg-opacity-90 text-white p-2 rounded-lg transition-colors"><Plus className="w-5 h-5" /></button>
            </form>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-primary p-6 rounded-2xl shadow-card text-white">
            <div className="flex items-center mb-3"><Sparkles className="w-5 h-5 mr-2" /><span className="font-semibold">FinSight AI Analyst</span></div>
            {aiInsight ? (
              <p className="text-sm leading-relaxed mb-4">{aiInsight}</p>
            ) : (
              <div>
                <p className="text-sm leading-relaxed mb-4 text-white/80">Requires at least 3 transactions to generate spending insights.</p>
                <button onClick={fetchAiInsight} disabled={loadingAi} className="bg-white text-primary px-4 py-2 rounded-lg font-medium hover:bg-gray-100 disabled:opacity-70 transition-colors text-sm">
                  {loadingAi ? "Analyzing..." : "Generate Insight"}
                </button>
              </div>
            )}
          </div>

          <div className="bg-surface p-6 rounded-2xl shadow-card flex-1">
            <h3 className="text-lg font-bold text-textMain mb-4">Latest Transactions</h3>
            <div className="space-y-4 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
              {transactions.length === 0 ? <p className="text-sm text-textMuted">No transactions yet.</p> : null}
              {transactions.map(tx => (
                <div key={tx.id} className="flex justify-between items-center text-sm border-b border-gray-50 pb-2">
                  <div>
                    <p className="font-semibold text-textMain">{tx.title}</p>
                    <p className="text-xs text-textMuted">{tx.category} • {new Date(tx.date).toLocaleDateString()}</p>
                  </div>
                  <span className={`font-medium ${isIncome(tx.type) ? 'text-success' : 'text-danger'}`}>
                    {isIncome(tx.type) ? '+' : '-'}${getAmount(tx.amount).toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
