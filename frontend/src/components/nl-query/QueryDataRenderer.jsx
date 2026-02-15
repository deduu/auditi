import React, { useState } from 'react';
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { ChevronDown, ChevronRight } from 'lucide-react';

const COLORS = ['#3b82f6', '#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#6366f1'];

function formatCellValue(value) {
  if (value === null || value === undefined) return '-';
  if (typeof value === 'number') {
    if (Math.abs(value) < 0.01 && value !== 0) return value.toExponential(2);
    if (Number.isInteger(value)) return value.toLocaleString();
    return value.toLocaleString(undefined, { maximumFractionDigits: 3 });
  }
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function DataTable({ data }) {
  if (!data.length) return null;
  const keys = Object.keys(data[0]).filter(k => k !== 'spans' && k !== 'id');

  return (
    <div className="overflow-x-auto max-h-64 overflow-y-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-slate-700">
            {keys.map((k) => (
              <th key={k} className="px-2 py-1.5 text-left text-slate-400 font-medium whitespace-nowrap">
                {k.replace(/_/g, ' ')}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, i) => (
            <tr key={i} className="border-b border-slate-800/50 hover:bg-slate-800/30">
              {keys.map((k) => (
                <td key={k} className="px-2 py-1.5 text-slate-300 whitespace-nowrap max-w-[200px] truncate">
                  {formatCellValue(row[k])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DataBarChart({ data }) {
  if (!data.length) return null;
  const keys = Object.keys(data[0]);
  const labelKey = keys[0];
  const valueKeys = keys.filter((k) => typeof data[0][k] === 'number').slice(0, 3);

  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
        <XAxis dataKey={labelKey} tick={{ fontSize: 10, fill: '#94a3b8' }} interval={0} angle={-30} textAnchor="end" height={50} />
        <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} width={50} />
        <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: 8, fontSize: 12 }} />
        {valueKeys.map((key, i) => (
          <Bar key={key} dataKey={key} fill={COLORS[i % COLORS.length]} radius={[2, 2, 0, 0]} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}

function DataLineChart({ data }) {
  if (!data.length) return null;
  const keys = Object.keys(data[0]);
  const xKey = keys.find(k => k === 'date') || keys[0];
  const valueKeys = keys.filter((k) => k !== xKey && typeof data[0][k] === 'number');

  return (
    <ResponsiveContainer width="100%" height={200}>
      <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
        <XAxis dataKey={xKey} tick={{ fontSize: 10, fill: '#94a3b8' }} />
        <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} width={50} />
        <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: 8, fontSize: 12 }} />
        {valueKeys.map((key, i) => (
          <Line key={key} type="monotone" dataKey={key} stroke={COLORS[i % COLORS.length]} strokeWidth={2} dot={false} />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}

function DataPieChart({ data }) {
  if (!data.length) return null;
  const keys = Object.keys(data[0]);
  const nameKey = keys[0];
  const valueKey = keys.find(k => typeof data[0][k] === 'number') || keys[1];

  return (
    <ResponsiveContainer width="100%" height={200}>
      <PieChart>
        <Pie data={data} dataKey={valueKey} nameKey={nameKey} cx="50%" cy="50%" outerRadius={70} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false} fontSize={10}>
          {data.map((_, i) => (
            <Cell key={i} fill={COLORS[i % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: 8, fontSize: 12 }} />
      </PieChart>
    </ResponsiveContainer>
  );
}

function NumberDisplay({ data }) {
  if (!data.length) return null;
  const item = data[0];
  const entries = Object.entries(item).filter(([, v]) => v !== null && v !== undefined);

  return (
    <div className="grid grid-cols-2 gap-2 p-3">
      {entries.map(([key, value]) => (
        <div key={key} className="text-center">
          <div className="text-lg font-bold text-white">{formatCellValue(value)}</div>
          <div className="text-xs text-slate-400">{key.replace(/_/g, ' ')}</div>
        </div>
      ))}
    </div>
  );
}

export function QueryDataRenderer({ data, visualization }) {
  const [expanded, setExpanded] = useState(true);

  if (!data || data.length === 0) return null;

  const renderContent = () => {
    switch (visualization) {
      case 'bar_chart':
        return (
          <>
            <div className="p-2"><DataBarChart data={data} /></div>
            <DataTable data={data} />
          </>
        );
      case 'line_chart':
        return (
          <>
            <div className="p-2"><DataLineChart data={data} /></div>
            <DataTable data={data} />
          </>
        );
      case 'pie_chart':
        return (
          <>
            <div className="p-2"><DataPieChart data={data} /></div>
            <DataTable data={data} />
          </>
        );
      case 'number':
        return <NumberDisplay data={data} />;
      default:
        return <DataTable data={data} />;
    }
  };

  return (
    <div>
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 px-3 py-2 text-xs text-slate-400 hover:text-slate-300 transition-colors"
      >
        {expanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
        <span>{data.length} result{data.length !== 1 ? 's' : ''}</span>
      </button>
      {expanded && renderContent()}
    </div>
  );
}
