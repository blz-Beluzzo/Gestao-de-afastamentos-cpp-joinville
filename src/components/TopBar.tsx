import React from 'react';
import { FileSpreadsheet, LogIn } from 'lucide-react';
import type { User } from 'firebase/auth';
import type { ConnectedSheetInfo } from '../types/ferias';

export type ActiveTab = 'cronograma' | 'mensal' | 'regras';

interface TopBarProps {
  activeTab: ActiveTab;
  onChangeTab: (tab: ActiveTab) => void;
  onOpenSheetsModal: () => void;
  user: User | null;
  hasToken: boolean;
  connectedSheet: ConnectedSheetInfo | null;
  onQuickSignIn: () => void;
  isSigningIn: boolean;
}

export const TopBar: React.FC<TopBarProps> = ({
  activeTab,
  onChangeTab,
  onOpenSheetsModal,
  user,
  hasToken,
  connectedSheet,
  onQuickSignIn,
  isSigningIn,
}) => {
  const navItems: { id: ActiveTab; label: string }[] = [
    { id: 'cronograma', label: 'Cronograma' },
    { id: 'mensal', label: 'Mensal' },
    { id: 'regras', label: 'Regras' },
  ];

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
      <div className="max-w-[1440px] mx-auto px-3 sm:px-6 h-16 flex items-center justify-between gap-3 sm:gap-8">
        {/* Zone 1: Single-line brand title */}
        <a
          href="#top"
          onClick={(e) => {
            e.preventDefault();
            onChangeTab('cronograma');
          }}
          className="font-display text-sm sm:text-lg font-bold tracking-tight text-[#1E3A5F] whitespace-nowrap truncate min-w-0"
        >
          Controle de Afastamentos - CPP Joinville
        </a>

        {/* Zone 2: Clean single-line navigation links */}
        <nav
          aria-label="Navegação principal"
          className="hidden md:flex items-center gap-6"
        >
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onChangeTab(item.id)}
                className={`py-2 text-sm font-medium whitespace-nowrap shrink-0 border-b-2 transition-colors focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#1E3A5F] ${
                  isActive
                    ? 'border-[#1E3A5F] text-[#0F172A]'
                    : 'border-transparent text-slate-600 hover:text-slate-900 hover:border-slate-300'
                }`}
              >
                {item.label}
              </button>
            );
          })}
          <button
            type="button"
            onClick={onOpenSheetsModal}
            className="py-2 text-sm font-medium whitespace-nowrap shrink-0 border-b-2 border-transparent text-slate-600 hover:text-slate-900 hover:border-slate-300 transition-colors focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#1E3A5F]"
          >
            Planilha
          </button>
        </nav>

        {/* Zone 3: Single primary CTA */}
        <div className="flex items-center shrink-0">
          {user && hasToken ? (
            <button
              type="button"
              onClick={onOpenSheetsModal}
              className="inline-flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 text-xs sm:text-sm font-medium rounded-md bg-[#1E3A5F] text-white hover:bg-[#162D4A] transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1E3A5F]"
            >
              <FileSpreadsheet className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span className="max-w-[140px] sm:max-w-[180px] truncate">
                {connectedSheet
                  ? connectedSheet.spreadsheetTitle
                  : 'Conectar Planilha'}
              </span>
            </button>
          ) : (
            <button
              type="button"
              onClick={onQuickSignIn}
              disabled={isSigningIn}
              className="inline-flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 text-xs sm:text-sm font-medium rounded-md bg-[#1E3A5F] text-white hover:bg-[#162D4A] disabled:opacity-60 transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1E3A5F]"
            >
              <LogIn className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>{isSigningIn ? 'Conectando...' : 'Entrar com Google'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Compact mobile navigation row */}
      <nav
        aria-label="Navegação móvel"
        className="md:hidden flex items-center gap-4 px-4 pb-2 border-t border-slate-100 overflow-x-auto"
      >
        {navItems.map((item) => {
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onChangeTab(item.id)}
              className={`py-2 text-xs font-medium whitespace-nowrap shrink-0 border-b-2 ${
                isActive
                  ? 'border-[#1E3A5F] text-[#0F172A]'
                  : 'border-transparent text-slate-600'
              }`}
            >
              {item.label}
            </button>
          );
        })}
        <button
          type="button"
          onClick={onOpenSheetsModal}
          className="py-2 text-xs font-medium whitespace-nowrap shrink-0 border-b-2 border-transparent text-slate-600"
        >
          Planilha
        </button>
      </nav>
    </header>
  );
};
