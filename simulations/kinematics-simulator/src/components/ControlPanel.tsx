import React, { useState, useEffect } from 'react';
import { ConstantParams } from '../types';

interface ControlPanelProps {
  params: ConstantParams;
  onChange: (params: ConstantParams) => void;
}

export const ControlPanel: React.FC<ControlPanelProps> = ({ params, onChange }) => {
  const [local, setLocal] = useState({
    x0: String(params.x0),
    v0: String(params.v0),
    a: String(params.a)
  });

  useEffect(() => {
    setLocal({
      x0: String(params.x0),
      v0: String(params.v0),
      a: String(params.a)
    });
  }, [params.x0, params.v0, params.a]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setLocal(prev => ({ ...prev, [name]: value }));
    
    if (value !== '' && value !== '-' && !isNaN(Number(value))) {
      onChange({
        ...params,
        [name]: Number(value)
      });
    }
  };

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    let num = Number(value);
    if (isNaN(num)) num = 0;
    onChange({
      ...params,
      [name]: num
    });
    setLocal(prev => ({ ...prev, [name]: String(num) }));
  };

  return (
    <section>
      <h3 className="text-[15px] font-bold text-slate-500 tracking-widest mb-4 flex items-center gap-2">
        <span className="w-1.5 h-1.5 bg-blue-500 rounded-full"></span>
        初始參數
      </h3>
      
      <div className="space-y-4">
        <div>
          <label className="block text-[12px] font-bold text-slate-400 mb-1">初始位置 (x₀)</label>
          <input 
            type="text" 
            name="x0" 
            value={local.x0} 
            onChange={handleChange}
            onBlur={handleBlur}
            className="w-full bg-[#0F172A] border border-slate-700 rounded p-2 text-[12px] font-mono text-slate-200 outline-none focus:border-blue-500"
          />
        </div>

        <div>
          <label className="block text-[12px] font-bold text-slate-400 mb-1">初始速度 (v₀)</label>
          <input 
            type="text" 
            name="v0" 
            value={local.v0} 
            onChange={handleChange}
            onBlur={handleBlur}
            className="w-full bg-[#0F172A] border border-slate-700 rounded p-2 text-[12px] font-mono text-slate-200 outline-none focus:border-blue-500"
          />
        </div>

        <div>
          <label className="block text-[12px] font-bold text-slate-400 mb-1">加速度 (a)</label>
          <input 
            type="text" 
            name="a" 
            value={local.a} 
            onChange={handleChange}
            onBlur={handleBlur}
            className="w-full bg-[#0F172A] border border-slate-700 rounded p-2 text-[12px] font-mono text-slate-200 outline-none focus:border-blue-500"
          />
        </div>
      </div>
    </section>
  );
};
