import express from "express";
import cors from "cors";

import { searchRussianFood } from "./sources/russianfood.js";

const app = express();

const PORT = Number(process.env.PORT) || 3000;

const SOURCES = [
  {
    id: "russianfood",
    name: "RussianFood",
    baseUrl: "https://www.russianfood.com"
  }
];

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  return res.json({
    ok: true,
    service: "RadarFridge Search",
    status: "online",
    sources: SOURCES
  });
});

app.get("/health", (req, res) => {
  return res.json({
    ok: true,
    status: "healthy"
  });
});

app.get("/search", async (req, res) => {
  try {
    const rawIngredients = String(req.query.ingredients || "").trim();

    if (!rawIngredients) {
      return res.status(400).json({
        ok: false,
        error: "Не указаны ингредиенты"
      });
    }

    const ingredients = rawIngredients
      .split(",")
      .map((ingredient) => ingredient.trim())
      .filter(Boolean);

    if (ingredients.length === 0) {
      return res.status(400).json({
        ok: false,
        error: "Список ингредиентов пуст"
      });
    }

    const recipes = await searchRussianFood(ingredients, {
      limit: 5
    });

    return res.json({
      ok: true,
      query: ingredients,
      count: recipes.length,
      recipes
    });
  } catch (error) {
    console.error("Ошибка маршрута /search:", error);

    return res.status(500).json({
      ok: false,
      error: "Внутренняя ошибка сервера"
    });
  }
});

app.use((req, res) => {
  return res.status(404).json({
    ok: false,
    error: "Маршрут не найден"
  });
});

app.listen(PORT, () => {
  console.log(`RadarFridge Search запущен на порту ${PORT}`);
});
