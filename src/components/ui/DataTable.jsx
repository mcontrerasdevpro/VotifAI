import { RefreshCw } from 'lucide-react';

const ALINEACION = {
  left: 'text-left',
  center: 'text-center',
  right: 'text-right'
};

/**
 * Tabla genérica con carga/vacío ya resueltos, extraída del patrón que
 * CensoPropietarios.jsx reescribía a mano (thead sticky + filas con
 * hover + estado vacío centrado).
 */
export default function DataTable({
  columns,
  data,
  keyField = 'id',
  loading = false,
  loadingLabel = 'Cargando...',
  emptyLabel = 'Sin resultados.'
}) {
  return (
    <table className="w-full text-left font-sans text-4xs">
      <thead className="bg-slate-900 text-slate-400 sticky top-0 border-b border-slate-800 font-bold z-10">
        <tr>
          {columns.map((col) => (
            <th key={col.key} className={`py-2.5 px-3 ${ALINEACION[col.align] || ALINEACION.left}`}>
              {col.header}
            </th>
          ))}
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-900 text-slate-300">
        {loading ? (
          <tr>
            <td colSpan={columns.length} className="py-10">
              <div className="flex flex-col items-center justify-center gap-2 text-4xs text-slate-500 font-bold uppercase tracking-widest animate-pulse">
                <RefreshCw size={16} className="animate-spin text-blue-500" /> {loadingLabel}
              </div>
            </td>
          </tr>
        ) : data && data.length > 0 ? (
          data.map((fila, index) => (
            <tr key={fila[keyField] ?? index} className="hover:bg-slate-900/30 transition-colors">
              {columns.map((col) => (
                <td key={col.key} className={`py-2.5 px-3 ${ALINEACION[col.align] || ALINEACION.left}`}>
                  {col.render ? col.render(fila, index) : fila[col.key]}
                </td>
              ))}
            </tr>
          ))
        ) : (
          <tr>
            <td colSpan={columns.length} className="text-center py-12 text-slate-600 font-medium uppercase tracking-widest text-[9px]">
              {emptyLabel}
            </td>
          </tr>
        )}
      </tbody>
    </table>
  );
}
