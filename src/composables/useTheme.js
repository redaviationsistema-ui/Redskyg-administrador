import { ref, onMounted } from "vue";

const theme = ref("light");

export function useTheme() {
  const setTheme = (value) => {
    theme.value = value;
    document.documentElement.setAttribute("data-theme", value);
    localStorage.setItem("theme", value);
  };

  const toggleTheme = () => {
    setTheme(theme.value === "light" ? "dark" : "light");
  };

  onMounted(() => {
    const saved = localStorage.getItem("theme") || "light";
    setTheme(saved);
  });

  return {
    theme,
    toggleTheme,
  };
}
