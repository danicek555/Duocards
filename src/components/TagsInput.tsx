"use client";

interface TagsInputProps {
  tags: string[];
  tagInput: string;
  onTagInputChange: (value: string) => void;
  onAddTag: () => void;
  onRemoveTag: (index: number) => void;
  existingUniqueTagsCount: number;
  maxTags?: number;
}

export default function TagsInput({
  tags,
  tagInput,
  onTagInputChange,
  onAddTag,
  onRemoveTag,
  existingUniqueTagsCount,
  maxTags = 5,
}: TagsInputProps) {
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      onAddTag();
    }
  };

  return (
    <div>
      <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">
        Tags (optional) - Max {maxTags} tags per set ({tags.length}/{maxTags})
      </label>
      <div className="text-xs text-gray-500 dark:text-gray-400 mb-1.5">
        Maximum 20 different tags allowed across all sets. You currently have{" "}
        {existingUniqueTagsCount} unique tags.
      </div>
      <div className="flex flex-wrap gap-2 mb-2">
        {tags.map((tag, index) => (
          <span
            key={index}
            className="px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded text-xs flex items-center gap-1"
          >
            {tag}
            <button
              type="button"
              onClick={() => onRemoveTag(index)}
              className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-200"
            >
              ×
            </button>
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          type="text"
          value={tagInput}
          onChange={(e) => onTagInputChange(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder={
            tags.length >= maxTags
              ? `Maximum ${maxTags} tags per set`
              : "Add a tag and press Enter"
          }
          maxLength={20}
          disabled={tags.length >= maxTags}
          className="flex-1 px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
        />
        <button
          type="button"
          onClick={onAddTag}
          disabled={tags.length >= maxTags}
          className="px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-xs disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Add
        </button>
      </div>
    </div>
  );
}




