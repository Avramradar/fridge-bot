import axios from "axios";
import * as cheerio from "cheerio";

const SOURCE_NAME = "RussianFood";
const BASE_URL = "https://www.russianfood.com";

const requestHeaders = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/137 Safari/537.36",
  "Accept-Language": "ru-RU,ru;q=0.9,en;q=0.7",
  Accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8"
};

function normalizeText(value = "") {
  return String(value)
    .replace(/\s+/g, " ")
    .replace(/\u00a0/g, " ")
    .trim();
}

function makeAbsoluteUrl(url = "") {
  const cleanUrl = normalizeText(url);

  if (!cleanUrl) {
    return "";
  }

  try {
    return new URL(cleanUrl, BASE_URL).toString();
  } catch {
    return "";
  }
}

function normalizeIngredients(ingredients) {
  const values = Array.isArray(ingredients)
    ? ingredients
    : String(ingredients || "").split(",");

  return values
    .map((ingredient) => normalizeText(ingredient).toLowerCase())
    .filter(Boolean)
    .filter((ingredient, index, list) => list.indexOf(ingredient) === index);
}

function calculateMatchScore(text, ingredients) {
  const normalizedText = normalizeText(text).toLowerCase();

  if (!normalizedText || ingredients.length === 0) {
    return {
      score: 0,
      matchedIngredients: []
    };
  }

  const matchedIngredients = ingredients.filter((ingredient) =>
    normalizedText.includes(ingredient)
  );

  return {
    score: matchedIngredients.length / ingredients.length,
    matchedIngredients
  };
}

function findRecipeCards($) {
  const selectors = [
    ".recipe_l",
    ".recipe",
    ".recipe-item",
    ".recipe_list_new",
    ".recipe_list",
    ".recipe-card",
    "article"
  ];

  const cards = [];

  for (const selector of selectors) {
    $(selector).each((index, element) => {
      cards.push(element);
    });

    if (cards.length > 0) {
      break;
    }
  }

  return cards;
}

function parseRecipeCard($, element, ingredients) {
  const card = $(element);

  const linkElement = card
    .find(
      [
        "a.recipe_l_title",
        "a.recipe-title",
        ".recipe_l_title a",
        ".recipe-title a",
        "h2 a",
        "h3 a",
        "a[href*='/recipes/recipe.php']"
      ].join(",")
    )
    .first();

  const fallbackLink = card.find("a[href]").first();

  const selectedLink = linkElement.length ? linkElement : fallbackLink;

  const title = normalizeText(
    selectedLink.attr("title") ||
      selectedLink.text() ||
      card.find("h2, h3, .title").first().text()
  );

  const url = makeAbsoluteUrl(selectedLink.attr("href"));

  if (!title || !url) {
    return null;
  }

  if (!url.includes("russianfood.com")) {
    return null;
  }

  const imageElement = card.find("img").first();

  const image = makeAbsoluteUrl(
    imageElement.attr("data-src") ||
      imageElement.attr("data-original") ||
      imageElement.attr("src")
  );

  const description = normalizeText(
    card
      .find(
        [
          ".recipe_l_descript",
          ".recipe-description",
          ".description",
          ".announce",
          "p"
        ].join(",")
      )
      .first()
      .text()
  );

  const cardText = normalizeText(card.text());
  const match = calculateMatchScore(
    `${title} ${description} ${cardText}`,
    ingredients
  );

  return {
    source: SOURCE_NAME,
    title,
    url,
    image,
    description,
    score: match.score,
    matchedIngredients: match.matchedIngredients
  };
}

function removeDuplicates(recipes) {
  const uniqueRecipes = new Map();

  for (const recipe of recipes) {
    const key = recipe.url || recipe.title.toLowerCase();

    if (!uniqueRecipes.has(key)) {
      uniqueRecipes.set(key, recipe);
    }
  }

  return [...uniqueRecipes.values()];
}

export async function searchRussianFood(ingredients, options = {}) {
  const normalizedIngredients = normalizeIngredients(ingredients);

  if (normalizedIngredients.length === 0) {
    return [];
  }

  const limit = Math.max(1, Math.min(Number(options.limit) || 10, 20));

  const searchText = normalizedIngredients.join(", ");

  try {
    const response = await axios.get(`${BASE_URL}/search/`, {
      params: {
        search: searchText
      },
      headers: requestHeaders,
      timeout: 15000,
      responseType: "text",
      validateStatus: (status) => status >= 200 && status < 400
    });

    const $ = cheerio.load(response.data);

    const cards = findRecipeCards($);

    const recipes = cards
      .map((element) => parseRecipeCard($, element, normalizedIngredients))
      .filter(Boolean);

    return removeDuplicates(recipes)
      .sort((firstRecipe, secondRecipe) => {
        return secondRecipe.score - firstRecipe.score;
      })
      .slice(0, limit);
  } catch (error) {
    console.error(
      `[${SOURCE_NAME}] Ошибка поиска:`,
      error.response?.status || error.message
    );

    return [];
  }
}

export const russianFoodSource = {
  id: "russianfood",
  name: SOURCE_NAME,
  baseUrl: BASE_URL,
  search: searchRussianFood
};
