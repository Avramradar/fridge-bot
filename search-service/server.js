import express from "express";
import cors from "cors";
import axios from "axios";
import * as cheerio from "cheerio";
import pLimit from "p-limit";
import { searchRussianFood } from "./sources/russianfood.js";

const app = express();

app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;

const limiter = pLimit(5);

const SOURCES = [
  {
    id: "russianfood",
    name: "RussianFood",
    baseUrl: "https://www.russianfood.com"
  },
  {
    id: "povarenok",
    name: "Поварёнок",
    baseUrl: "https://www.povarenok.ru"
  },
  {
    id: "iamcook",
    name: "Аймкук",
    baseUrl: "https://www.iamcook.ru"
  },
  {
    id: "menu1000",
    name: "1000.menu",
    baseUrl: "https://1000.menu"
  },
  {
    id: "edimdoma",
    name: "Едим Дома",
    baseUrl: "https://www.edimdoma.ru"
  },
  {
    id: "gastronom",
    name: "Гастроном",
    baseUrl: "https://www.gastronom.ru"
  },
  {
    id: "gotovim",
    name: "Готовим дома",
    baseUrl: "https://gotovim-doma.ru"
  },
  {
    id: "koolinar",
    name: "Koolinar",
    baseUrl: "https://koolinar.ru"
  },
  {
    id: "menunedeli",
    name: "Меню недели",
    baseUrl: "https://menunedeli.ru"
  }
];

const browserHeaders = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/137 Safari/537.36",
  "Accept-Language": "ru-RU,ru;q=0.9"
};

app.get("/", (req, res) => {
  res.json({
    service: "RadarFridge Search",
    status: "online",
    sources: SOURCES.length
  });
});
app.get("/search", async (req, res) => {
  try {
    const ingredients = String(req.query.ingredients || "")
      .trim();

    if (!ingredients) {
      return res.status(400).json({
        ok: false,
        error: "Не указаны ингредиенты"
      });
    }

    res.json({
      ok: true,
      query: ingredients,
      message: "Поиск пока находится в разработке",
      sources: SOURCES.map(source => source.name)
    });

  } catch (error) {
    console.error(error);

    res.status(500).json({
      ok: false,
      error: "Внутренняя ошибка сервера"
    });
  }
});

app.listen(PORT, () => {
  console.log(`✅ RadarFridge Search запущен на порту ${PORT}`);
});
