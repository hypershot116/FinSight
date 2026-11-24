import React, { useState, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api';
import { AreaChart, Area, XAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { Wallet, TrendingUp, TrendingDown, PieChart as PieIcon, Sparkles, LogOut, Plus, ShieldAlert, Trash2, Pencil, Check, Key, ExternalLink, Download, Upload, Target, Search } from 'lucide-react';
import { Link } from 'react-router-dom';

interface Transaction { id: number; amount: number; title: string; category: string; type: string; date: string; }
interface Budget { id: number; category: string; monthly_limit: number; }

const EXPENSE_CATEGORIES = ['Food', 'Transport', 'Housing', 'General'];
const INCOME_CATEGORIES = ['Salary', 'Investment', 'Other'];
const CURRENCIES = ['USD', 'BDT', 'EUR', 'GBP'];

export default function Dashboard() {
  const { logout } = useAuth();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // UI State
  const [form, setForm] = useState({ title: '', amount: '', category: 'Food', type: 'EXPENSE', date: new Date().toISOString().split('T')[0] });
  const [editingId, setEditingId] = useState<number | null>(null);
  const [filter, setFilter] = useState({ type: 'ALL', search: '', month: new Date().toISOString().slice(0, 7) });
  const [budgetForm, setBudgetForm] = useState({ category: 'Food', limit: '' });

  // AI & BYOK State
  const [aiInsight, setAiInsight] = useState<string>('');
  const [aiProviderUsed, setAiProviderUsed] = useState<string>('');
  const [loadingAi, setLoadingAi] = useState<boolean>(false);
  const [showKeySettings, setShowKeySettings] = useState<boolean>(false);
  const [savedAiKey, setSavedAiKey] = useState<string>(() => localStorage.getItem('finsight_ai_key') || '');
  const [savedAiProvider, setSavedAiProvider] = useState<'groq' | 'gemini'>(() => (localStorage.getItem('finsight_ai_provider') as 'groq' | 'gemini') || 'groq');
  const [keyInput, setKeyInput] = useState<string>(savedAiKey);
  const [providerInput, setProviderInput] = useState<'groq' | 'gemini'>(savedAiProvider);

  // Data Fetching
  const { data: userProfile } = useQuery({ queryKey: ['me'], queryFn: async () => (await api.get('/me')).data });
  const { data: transactions = [], isLoading } = useQuery<Transaction[]>({ queryKey: ['transactions'], queryFn: async () => (await api.get('/transactions')).data });
  const { data: budgets = [] } = useQuery<Budget[]>({ queryKey: ['budgets'], queryFn: async () => (await api.get('/budgets')).data });

  // Mutations
  const resetForm = () => { setForm({ title: '', amount: '', category: 'Food', type: 'EXPENSE', date: new Date().toISOString().split('T')[0] }); setEditingId(null); };
  
  const mutTx = useMutation({
    mutationFn: async (data: any) => editingId ? api.put(`/transactions/${editingId}`, data) : api.post('/transactions', data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['transactions'] }); resetForm(); },
  });
  const delTx = useMutation({ mutationFn: async (id: number) => api.delete(`/transactions/${id}`), onSuccess: () => queryClient.invalidateQueries({ queryKey: ['transactions'] }) });
  
  const mutCurrency = useMutation({ mutationFn: async (c: string) => api.put('/me/currency', { currency: c }), onSuccess: () => queryClient.invalidateQueries({ queryKey: ['me'] }) });
  const mutBudget = useMutation({ mutationFn: async (data: any) => api.put('/budgets', data), onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['budgets'] }); setBudgetForm({ ...budgetForm, limit: '' }); } });
  const mutBulk = useMutation({ mutationFn: async (data: any) => api.post('/transactions/bulk', data), onSuccess: () => queryClient.invalidateQueries({ queryKey: ['transactions'] }) });

  // Handlers
  const handleTypeChange = (newType: string) => {
    const valid = newType === 'INCOME' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
    setForm({ ...form, type: newType, category: valid.includes(form.category) ? form.category : valid[0] });
  };

  const handleEditClick = (tx: Transaction) => {
    const isInc = tx.type?.toUpperCase().includes('INCOME');
    setForm({ title: tx.title, amount: tx.amount.toString(), category: tx.category, type: isInc ? 'INCOME' : 'EXPENSE', date: tx.date.split('T')[0] });
    setEditingId(tx.id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCsvImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const lines = (evt.target?.result as string).split('\n').filter(l => l.trim());
      const newTxs = lines.slice(1).map(l => {
        const [date, title, amount, category, type] = l.split(',');
        return { date: date ? new Date(date).toISOString() : new Date().toISOString(), title, amount: parseFloat(amount), category, type: type?.trim() };
      }).filter(t => !isNaN(t.amount) && t.title);
      if (newTxs.length) mutBulk.mutate({ transactions: newTxs });
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleCsvExport = () => {
    const csv = ['Date,Title,Amount,Category,Type\n'].concat(filteredTransactions.map(t => `${t.date.split('T')[0]},${t.title},${t.amount},${t.category},${t.type}`)).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'finsight_export.csv'; a.click(); URL.revokeObjectURL(url);
  };

  const fetchAiInsight = async () => {
    setLoadingAi(true);
    try {
      const headers: Record<string, string> = {};
      if (savedAiKey) { headers['X-AI-Key'] = savedAiKey; headers['X-AI-Provider'] = savedAiProvider; }
      const res = await api.get('/insights', { headers });
      setAiInsight(res.data.insight);
      setAiProviderUsed(res.data.provider || '');
    } catch (error: any) {
      setAiInsight(error.response?.data?.detail || 'Network error connecting to AI.');
      setAiProviderUsed('');
    }
    setLoadingAi(false);
  };

  // Formatting & Calculations
  const fmt = (amt: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: userProfile?.currency || 'USD' }).format(amt);
  const isIncome = (type: string) => type?.toUpperCase().includes('INCOME');
  
  const currentMonthTxs = transactions.filter(t => t.date.startsWith(filter.month));
  const income = currentMonthTxs.filter(t => isIncome(t.type)).reduce((acc, t) => acc + Number(t.amount), 0);
  const expense = currentMonthTxs.filter(t => !isIncome(t.type)).reduce((acc, t) => acc + Number(t.amount), 0);
  
  const filteredTransactions = transactions.filter(t => {
    if (filter.type !== 'ALL' && ((filter.type === 'INCOME') !== isIncome(t.type))) return false;
    if (filter.month && !t.date.startsWith(filter.month)) return false;
    if (filter.search && !t.title.toLowerCase().includes(filter.search.toLowerCase())) return false;
    return true;
  });

  const spentByCategory = currentMonthTxs.filter(t => !isIncome(t.type)).reduce((acc: any, t) => {
    acc[t.category] = (acc[t.category] || 0) + Number(t.amount);
    return acc;
  }, {});

  const breakdownData = Object.keys(spentByCategory).map((key, i) => ({ name: key, value: spentByCategory[key], color: ['#0284C7', '#10B981', '#0EA5E9', '#F59E0B', '#8B5CF6', '#EF4444'][i % 6] }));
  
  const flowByDate = currentMonthTxs.reduce((acc: any, t) => {
    const d = new Date(t.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    if (!acc[d]) acc[d] = { date: d, INCOME: 0, EXPENSE: 0 };
    acc[d][isIncome(t.type) ? 'INCOME' : 'EXPENSE'] += Number(t.amount);
    return acc;
  }, {});
  const cashFlowData = Object.values(flowByDate).reverse();

  if (isLoading) return <div className="min-h-screen bg-background flex items-center justify-center">Loading...</div>;

  return (
    <div className="min-h-screen bg-background p-8 font-sans pb-24">
      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <div className="flex items-center text-primary">
          <svg className="w-8 h-8 mr-2" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2L2 22h20L12 2zm0 4.5l6.5 13h-13L12 6.5z" /></svg>
          <h1 className="text-2xl font-bold text-textMain">FinSight</h1>
          {userProfile?.name && <span className="ml-4 text-sm text-textMuted border-l pl-4 border-gray-300">Welcome, {userProfile.name}</span>}
        </div>
        <div className="flex items-center gap-6">
          <select value={userProfile?.currency || 'USD'} onChange={(e) => mutCurrency.mutate(e.target.value)} className="bg-white border border-gray-200 text-sm rounded-lg px-2 py-1 outline-none">
            {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          {userProfile?.is_admin && <Link to="/admin" className="flex items-center text-teal-600 font-medium"><ShieldAlert className="w-5 h-5 mr-1" /> Admin</Link>}
          <button onClick={() => { queryClient.clear(); logout(); }} className="flex items-center text-textMuted hover:text-danger"><LogOut className="w-5 h-5 mr-1" /> Logout</button>
        </div>
      </div>

      {/* KPI Cards (Filtered by Month) */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
        <div className="bg-surface p-5 rounded-2xl shadow-card">
          <div className="flex text-textMuted mb-2 items-center text-sm font-medium"><Wallet className="w-4 h-4 mr-2" /> Net Flow ({filter.month})</div>
          <div className="text-3xl font-bold text-textMain">{fmt(income - expense)}</div>
        </div>
        <div className="bg-surface p-5 rounded-2xl shadow-card">
          <div className="flex text-textMuted mb-2 items-center text-sm font-medium"><TrendingDown className="w-4 h-4 mr-2" /> Income</div>
          <div className="text-3xl font-bold text-success">{fmt(income)}</div>
        </div>
        <div className="bg-surface p-5 rounded-2xl shadow-card">
          <div className="flex text-textMuted mb-2 items-center text-sm font-medium"><TrendingUp className="w-4 h-4 mr-2" /> Expense</div>
          <div className="text-3xl font-bold text-danger">{fmt(expense)}</div>
        </div>
        <div className="bg-surface p-5 rounded-2xl shadow-card">
          <div className="flex text-textMuted mb-2 items-center text-sm font-medium"><PieIcon className="w-4 h-4 mr-2" /> Breakdown</div>
          <div className="h-24 flex items-center justify-center">
            {breakdownData.length ? (
              <ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={breakdownData} innerRadius={25} outerRadius={40} dataKey="value" stroke="none">{breakdownData.map((e, i) => <Cell key={i} fill={e.color} />)}</Pie><Tooltip contentStyle={{ borderRadius: '8px', border: 'none' }} /></PieChart></ResponsiveContainer>
            ) : <span className="text-xs text-textMuted">No expenses</span>}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column: Cash Flow & Forms */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-surface p-6 rounded-2xl shadow-card flex flex-col justify-between">
            <h3 className="text-lg font-bold text-textMain mb-4">Cash Flow Overview</h3>
            <div className="h-64 mb-6">
              {cashFlowData.length ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={cashFlowData}>
                    <defs>
                      <linearGradient id="cInc" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#10B981" stopOpacity={0.2} /><stop offset="95%" stopColor="#10B981" stopOpacity={0} /></linearGradient>
                      <linearGradient id="cExp" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#0284C7" stopOpacity={0.2} /><stop offset="95%" stopColor="#0284C7" stopOpacity={0} /></linearGradient>
                    </defs>
                    <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748B' }} />
                    <Tooltip cursor={{ stroke: '#cbd5e1', strokeDasharray: '4 4' }} contentStyle={{ borderRadius: '8px', border: 'none' }} />
                    <Legend iconType="circle" wrapperStyle={{ fontSize: '12px' }} />
                    <Area type="monotone" name="Income" dataKey="INCOME" stroke="#10B981" strokeWidth={2} fillOpacity={1} fill="url(#cInc)" />
                    <Area type="monotone" name="Expense" dataKey="EXPENSE" stroke="#0284C7" strokeWidth={2} fillOpacity={1} fill="url(#cExp)" />
                  </AreaChart>
                </ResponsiveContainer>
              ) : <div className="h-full flex items-center justify-center text-sm text-textMuted">No data for selected month</div>}
            </div>

            <div className={`border-t border-gray-100 pt-4 transition-colors ${editingId ? 'bg-yellow-50/50 -mx-6 px-6 pb-2 rounded-b-2xl' : ''}`}>
              <div className="flex justify-between items-center mb-3">
                <h3 className="text-sm font-bold text-textMain">{editingId ? 'Edit Transaction' : 'Quick Add Transaction'}</h3>
                {editingId && <button onClick={resetForm} className="text-xs text-gray-500 hover:text-gray-700">Cancel Edit</button>}
              </div>
              <form onSubmit={e => { e.preventDefault(); mutTx.mutate({ ...form, amount: parseFloat(form.amount), date: new Date(form.date).toISOString() }); }} className="flex gap-3 flex-wrap">
                <input type="date" required value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} className="px-3 py-2 border rounded-lg text-sm bg-white outline-none focus:ring-1 focus:ring-primary" />
                <input type="text" required placeholder="Title" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} className="flex-1 min-w-[120px] px-3 py-2 border rounded-lg text-sm bg-white outline-none focus:ring-1 focus:ring-primary" />
                <input type="number" step="0.01" required placeholder="Amount" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} className="w-24 px-3 py-2 border rounded-lg text-sm bg-white outline-none focus:ring-1 focus:ring-primary" />
                <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} className="px-3 py-2 border rounded-lg text-sm bg-white outline-none focus:ring-1 focus:ring-primary">
                  {(form.type === 'INCOME' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES).map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <select value={form.type} onChange={e => handleTypeChange(e.target.value)} className="px-3 py-2 border rounded-lg text-sm bg-white outline-none focus:ring-1 focus:ring-primary">
                  <option value="EXPENSE">Expense</option><option value="INCOME">Income</option>
                </select>
                <button type="submit" disabled={mutTx.isPending} className={`p-2 rounded-lg text-white ${editingId ? 'bg-yellow-500' : 'bg-primary'}`}>{editingId ? <Check className="w-5 h-5" /> : <Plus className="w-5 h-5" />}</button>
              </form>
            </div>
          </div>
        </div>

        {/* Right Column: AI & Budgets */}
        <div className="space-y-6">
          <div className="bg-primary p-6 rounded-2xl shadow-card text-white">
            <div className="flex justify-between items-center mb-3">
              <div className="flex items-center"><Sparkles className="w-5 h-5 mr-2" /><span className="font-semibold">AI Analyst</span></div>
              <button onClick={() => setShowKeySettings(!showKeySettings)} className="flex items-center text-xs bg-white/15 px-2 py-1 rounded-lg"><Key className="w-3.5 h-3.5 mr-1" /> {savedAiKey ? 'Custom Key' : 'Use Your Key'}</button>
            </div>
            {showKeySettings && (
              <div className="mb-4 p-3 rounded-xl bg-black/20 text-xs space-y-2">
                <p className="text-white/90">Add a free Groq key (no CC required) to bypass rate limits.</p>
                <form onSubmit={e => { e.preventDefault(); const t = keyInput.trim(); localStorage.setItem('finsight_ai_key', t); localStorage.setItem('finsight_ai_provider', providerInput); setSavedAiKey(t); setSavedAiProvider(providerInput); setShowKeySettings(false); }} className="flex gap-2">
                  <select value={providerInput} onChange={e => setProviderInput(e.target.value as 'groq')} className="px-2 py-1 rounded bg-white text-gray-900 focus:outline-none"><option value="groq">Groq</option><option value="gemini">Gemini</option></select>
                  <input type="password" placeholder="Key..." value={keyInput} onChange={e => setKeyInput(e.target.value)} className="flex-1 px-2 py-1 rounded bg-white text-gray-900 focus:outline-none" />
                  <button type="submit" className="px-3 py-1 rounded bg-white text-primary font-semibold">Save</button>
                </form>
              </div>
            )}
            {aiInsight ? (
              <div><p className="text-sm leading-relaxed mb-3">{aiInsight}</p><div className="flex justify-between text-[11px] text-white/75 pt-2 border-t border-white/15"><span>{aiProviderUsed && `Powered by ${aiProviderUsed}`}</span><button onClick={fetchAiInsight} disabled={loadingAi}>{loadingAi ? 'Analyzing...' : 'Regenerate'}</button></div></div>
            ) : (
              <div><p className="text-sm text-white/85 mb-4">Requires at least 3 transactions.</p><button onClick={fetchAiInsight} disabled={loadingAi} className="bg-white text-primary px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-100 disabled:opacity-70">{loadingAi ? 'Analyzing...' : 'Generate Insight'}</button></div>
            )}
          </div>

          <div className="bg-surface p-6 rounded-2xl shadow-card">
            <h3 className="text-lg font-bold text-textMain mb-4 flex items-center"><Target className="w-5 h-5 mr-2 text-primary" /> Monthly Budgets</h3>
            <div className="space-y-4 mb-4">
              {budgets.map(b => {
                const spent = spentByCategory[b.category] || 0;
                const pct = Math.min(100, (spent / b.monthly_limit) * 100);
                const color = pct >= 100 ? 'bg-red-500' : pct >= 80 ? 'bg-amber-500' : 'bg-emerald-500';
                return (
                  <div key={b.id}>
                    <div className="flex justify-between text-xs font-medium mb-1"><span className="text-textMain">{b.category}</span><span className="text-textMuted">{fmt(spent)} / {fmt(b.monthly_limit)}</span></div>
                    <div className="w-full bg-gray-100 rounded-full h-2"><div className={`${color} h-2 rounded-full transition-all`} style={{ width: `${pct}%` }} /></div>
                  </div>
                );
              })}
              {!budgets.length && <p className="text-sm text-textMuted text-center">No budgets set.</p>}
            </div>
            <form onSubmit={e => { e.preventDefault(); mutBudget.mutate({ category: budgetForm.category, monthly_limit: parseFloat(budgetForm.limit) }); }} className="flex gap-2 border-t border-gray-100 pt-4">
              <select value={budgetForm.category} onChange={e => setBudgetForm({ ...budgetForm, category: e.target.value })} className="px-2 py-1.5 border rounded-lg text-xs bg-white outline-none">
                {EXPENSE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <input type="number" required placeholder="Limit" value={budgetForm.limit} onChange={e => setBudgetForm({ ...budgetForm, limit: e.target.value })} className="flex-1 px-2 py-1.5 border rounded-lg text-xs bg-white outline-none" />
              <button type="submit" disabled={mutBudget.isPending} className="bg-gray-900 text-white px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-gray-800">Set</button>
            </form>
          </div>
        </div>
      </div>

      {/* Filter Bar & List */}
      <div className="mt-6 bg-surface p-6 rounded-2xl shadow-card">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-4">
          <h3 className="text-lg font-bold text-textMain">Transactions</h3>
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-2.5 top-2 text-gray-400" />
              <input type="text" placeholder="Search title..." value={filter.search} onChange={e => setFilter({ ...filter, search: e.target.value })} className="pl-8 pr-3 py-1.5 text-sm border rounded-lg outline-none focus:ring-1" />
            </div>
            <input type="month" value={filter.month} onChange={e => setFilter({ ...filter, month: e.target.value })} className="px-3 py-1.5 text-sm border rounded-lg outline-none" />
            <div className="flex bg-gray-100 p-1 rounded-lg">
              <button onClick={() => setFilter({ ...filter, type: 'ALL' })} className={`px-3 py-1 text-xs font-medium rounded-md ${filter.type === 'ALL' ? 'bg-white shadow text-gray-900' : 'text-gray-500'}`}>All</button>
              <button onClick={() => setFilter({ ...filter, type: 'INCOME' })} className={`px-3 py-1 text-xs font-medium rounded-md ${filter.type === 'INCOME' ? 'bg-white shadow text-emerald-600' : 'text-gray-500'}`}>In</button>
              <button onClick={() => setFilter({ ...filter, type: 'EXPENSE' })} className={`px-3 py-1 text-xs font-medium rounded-md ${filter.type === 'EXPENSE' ? 'bg-white shadow text-red-500' : 'text-gray-500'}`}>Out</button>
            </div>
            <div className="flex gap-2">
              <button onClick={handleCsvExport} className="flex items-center text-xs bg-gray-100 hover:bg-gray-200 px-3 py-1.5 rounded-lg text-gray-700 transition-colors"><Download className="w-3.5 h-3.5 mr-1" /> Export CSV</button>
              <button onClick={() => fileInputRef.current?.click()} className="flex items-center text-xs bg-gray-100 hover:bg-gray-200 px-3 py-1.5 rounded-lg text-gray-700 transition-colors"><Upload className="w-3.5 h-3.5 mr-1" /> Import CSV</button>
              <input type="file" accept=".csv" ref={fileInputRef} onChange={handleCsvImport} className="hidden" />
            </div>
          </div>
        </div>

        <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
          {!filteredTransactions.length && <p className="text-sm text-textMuted text-center py-8">No matching transactions.</p>}
          {filteredTransactions.map(tx => (
            <div key={tx.id} className="flex justify-between items-center text-sm border border-gray-100 p-3 rounded-xl hover:border-gray-200 group transition-colors bg-white">
              <div className="flex-1">
                <p className="font-semibold text-textMain">{tx.title}</p>
                <p className="text-xs text-textMuted">{tx.category} • {new Date(tx.date).toLocaleDateString('en-US', { timeZone: 'UTC' })}</p>
              </div>
              <div className="flex items-center gap-4">
                <span className={`font-bold ${isIncome(tx.type) ? 'text-success' : 'text-danger'}`}>{isIncome(tx.type) ? '+' : '-'}{fmt(tx.amount)}</span>
                <div className="flex space-x-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => handleEditClick(tx)} className="text-gray-400 hover:text-blue-500"><Pencil className="w-4 h-4" /></button>
                  <button onClick={() => delTx.mutate(tx.id)} disabled={delTx.isPending} className="text-gray-400 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}