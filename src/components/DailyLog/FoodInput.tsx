import { useState } from 'react'
import { useTheme } from '@/themes'

interface FoodInputProps {
  foods: string[]
  onChange: (foods: string[]) => void
}

export function FoodInput({ foods, onChange }: FoodInputProps) {
  const { palette, isDark } = useTheme()
  const [input, setInput] = useState('')

  const addFood = () => {
    const trimmed = input.trim()
    if (!trimmed) return
    if (!foods.includes(trimmed)) {
      onChange([...foods, trimmed])
    }
    setInput('')
  }

  const removeFood = (food: string) => {
    onChange(foods.filter((f) => f !== food))
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      addFood()
    }
  }

  return (
    <div className="mb-4">
      <span className="text-sm font-medium block mb-2">Foods eaten</span>

      {/* Food tags */}
      {foods.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {foods.map((food) => (
            <span
              key={food}
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs ${
                isDark ? 'bg-white/10' : 'bg-black/[0.06]'
              }`}
            >
              {food}
              <button
                onClick={() => removeFood(food)}
                className="opacity-40 hover:opacity-70 ml-0.5"
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Add a food..."
          className={`flex-1 px-3 py-1.5 rounded-xl text-sm focus:outline-none focus:ring-2 ${
            isDark
              ? 'bg-white/5 placeholder:text-white/20'
              : 'bg-black/[0.03] placeholder:text-black/20'
          }`}
          style={{ ['--tw-ring-color' as string]: palette.accent + '4D' }}
        />
        <button
          onClick={addFood}
          disabled={!input.trim()}
          className={`px-3 py-1.5 rounded-xl text-xs font-medium ${!input.trim() ? 'opacity-30' : ''}`}
          style={{ backgroundColor: palette.accent + '33' }}
        >
          Add
        </button>
      </div>
    </div>
  )
}
