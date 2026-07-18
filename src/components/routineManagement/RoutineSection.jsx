import { useState } from 'react';
import Routine from './Routine';
import IncourseExamRoutine from './IncourseExamRoutine';
import FinalExamRoutine from './FinalExamRoutine';

const TABS = [
  { key: 'class',    label: 'Class Routine'        },
  { key: 'incourse', label: 'Incourse Exam Routine' },
  { key: 'final',    label: 'Final Exam Routine'    },
];

export default function RoutineSection({ semesterId, selectedSemesters = [], onNavigate }) {
  const [tab, setTab] = useState('class');

  return (
    <div>
      <div style={{
        display: 'flex', borderBottom: '2px solid #e5e7eb',
        background: 'white', padding: '0 24px',
      }}>
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{
            padding: '11px 22px', fontSize: 13, fontWeight: 700,
            cursor: 'pointer', background: 'none', border: 'none',
            borderBottom: tab === t.key ? '2.5px solid #1a3a52' : '2.5px solid transparent',
            color: tab === t.key ? '#1a3a52' : '#6b7280',
            marginBottom: -2, whiteSpace: 'nowrap',
          }}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'class'    && <Routine semesterId={semesterId} onNavigate={onNavigate} />}
      {tab === 'incourse' && <IncourseExamRoutine semesterId={semesterId} selectedSemesters={selectedSemesters} />}
      {tab === 'final'    && <FinalExamRoutine selectedSemesters={selectedSemesters} />}
    </div>
  );
}
