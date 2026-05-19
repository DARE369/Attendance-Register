export default function ClassFilter({ classes, value, onChange }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="px-3 py-2 border border-gray-300 rounded-lg text-sm font-medium
                 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500
                 min-w-[140px]"
    >
      <option value="all">All Classes</option>
      {classes.map((cls) => (
        <option key={cls} value={cls}>{cls}</option>
      ))}
    </select>
  );
}
