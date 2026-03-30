const btn = document.getElementById("toggleTheme");

// Carregar tema salvo (quando existir)
const savedTheme = localStorage.getItem("theme");
if (savedTheme === "light") {
    document.body.classList.add("light");
    document.documentElement.classList.remove("dark");
    document.documentElement.classList.add("light");
} else if (savedTheme === "dark") {
    document.body.classList.remove("light");
    document.documentElement.classList.remove("light");
    document.documentElement.classList.add("dark");
}

// Se o botão existir (apenas na página inicial ou dashboard), registra o listener
if (btn) {
    // Definir ícone inicial
    btn.textContent = (savedTheme === "light") ? "🌞" : "🌓";

    btn.addEventListener("click", () => {
        document.body.classList.toggle("light");

        // Salva a preferência e atualiza os elementos
        if (document.body.classList.contains("light")) {
            document.documentElement.classList.remove("dark");
            document.documentElement.classList.add("light");
            localStorage.setItem("theme", "light");
            btn.textContent = "🌞";
        } else {
            document.documentElement.classList.remove("light");
            document.documentElement.classList.add("dark");
            localStorage.setItem("theme", "dark");
            btn.textContent = "🌓";
        }
    });
}