'use client';
import { useState, useEffect } from 'react';
import { Search, Filter, Inbox as InboxIcon, Brain } from 'lucide-react';

export default function Inbox() {
  const [items, setItems] = useState([]);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (filter !== 'all') params.set('filter', filter);
        if (search) params.set('search', search);

        const res = await fetch(`/api/items?${params.toString()}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        setItems(data || []);
      } catch (err) {
        console.error('Error loading items:', err);
        setItems([]);
      }
      setLoading(false);
    }
    load();
  }, [filter, search]);

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 font-sans">
      {/* Sidebar / Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Brain className="text-teal-600 w-8 h-8" />
            <h1 className="text-xl font-bold tracking-tight">Second Brain</h1>
          </div>
          <div className="flex items-center gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input 
                placeholder="Search your saves..." 
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-10 pr-4 py-2 bg-gray-100 border-none rounded-full text-sm focus:ring-2 focus:ring-teal-500 w-64 transition-all"
              />
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8 flex gap-8">
        {/* Filters Sidebar */}
        <aside className="w-48 flex-shrink-0 hidden md:block">
          <nav className="space-y-1">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4 px-3">Filters</p>
            {['all', 'idea', 'reel', 'article', 'document', 'other'].map(t => (
              <button 
                key={t} 
                onClick={() => setFilter(t)}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors capitalize ${
                  filter === t ? 'bg-teal-50 text-teal-700' : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                {t}
              </button>
            ))}
          </nav>
        </aside>

        {/* Content Area */}
        <section className="flex-1">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <InboxIcon className="w-5 h-5 text-gray-400" />
              Inbox
            </h2>
            <p className="text-sm text-gray-500">{items.length} items found</p>
          </div>

          {loading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600"></div>
            </div>
          ) : items.length === 0 ? (
            <div className="bg-white border border-dashed border-gray-300 rounded-xl p-12 text-center">
              <p className="text-gray-500 mb-2">No items found matching your criteria.</p>
              <button 
                onClick={() => {setFilter('all'); setSearch('');}}
                className="text-teal-600 font-medium hover:underline text-sm"
              >
                Clear all filters
              </button>
            </div>
          ) : (
            <div className="grid gap-4">
              {items.map(item => (
                <div key={item.id} className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex justify-between items-start mb-3">
                    <span className="text-[10px] font-bold uppercase tracking-wider bg-teal-50 text-teal-700 px-2 py-0.5 rounded border border-teal-100">
                      {item.tag || 'uncategorized'}
                    </span>
                    <span className="text-xs text-gray-400">
                      {new Date(item.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                    </span>
                  </div>
                  <p className="text-gray-800 leading-relaxed whitespace-pre-wrap">{item.content}</p>
                  {item.source_url && (
                    <a 
                      href={item.source_url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-xs text-teal-600 mt-3 inline-block hover:underline truncate max-w-full"
                    >
                      {item.source_url}
                    </a>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
