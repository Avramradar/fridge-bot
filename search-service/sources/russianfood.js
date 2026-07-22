import axios from "axios";
import * as cheerio from "cheerio";

const SOURCE_NAME = "RussianFood";
const BASE_URL = "https://www.russianfood.com";

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/137.0.0.0 Safari/537.36",
  Accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  "Accept-Language": "ru-RU,ru;q=0.9,en;q=0.7",
  Referer: `${BASE_URL}/`
};

function normalizeText(value = "") {
  return String(value)
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeIngredients(ingredients) {
  const ingredientList = Array.isArray(ingredients)
    ? ingredients
    : String(ingredients || "").split(",");

  return ingredientList
    .map((ingredient) => normalizeText(ingredient).toLowerCase())
    .filter(Boolean)
    .filter((ingredient, index, list) => {
      return list.indexOf(ingredient) === index;
    });
}

function makeAbsoluteUrl(value = "") {
  const url = normalizeText(value);

  if (!url) {
    return "";
  }

  try {
    return new URL(url, BASE_URL).toString();
  } catch {
    return "";
  }
}

function calculateMatch(text, ingredients) {
  const normalizedText = normalizeText(text).toLowerCase();

  const matchedIngredients = ingredients.filter((ingredient) => {
    return normalizedText.includes(ingredient);
  });

  const score =
    ingredients.length > 0
      ? matchedIngredients.length / ingredients.length
      : 0;

  return {
    score,
    matchedIngredients
  };
}

function findRecipeContainer($, linkElement) {
  const link = $(linkElement);

  const containerSelectors = [
    ".recipe_l",
    ".recipe",
    ".recipe-item",
    ".recipe-card",
    ".recipe_list_new",
    ".recipe_list",
    "article",
    "li",
    "tr"
  ];

  for (const selector of containerSelectors) {
    const container = link.closest(selector);

    if (container.length > 0) {
      return container.first();
    }
  }

  return link.parent();
}

function getRecipeTitle($, linkElement, container) {
  const link = $(linkElement);

  const titleFromAttribute = normalizeText(link.attr("title"));

  if (titleFromAttribute) {
    return titleFromAttribute;
  }

  const titleFromLink = normalizeText(link.text());

  if (titleFromLink) {
    return titleFromLink;
  }

  return normalizeText(
    container
      .find("h1, h2, h3, h4, .title, .recipe-title")
      .first()
      .text()
  );
}

function getRecipeImage(container) {
  const imageElement = container.find("img").first();

  const imageUrl =
    imageElement.attr("data-src") ||
    imageElement.attr("data-original") ||
    imageElement.attr("data-lazy-src") ||
    imageElement.attr("src") ||
    "";

  return makeAbsoluteUrl(imageUrl);
}

function getRecipeDescription(container) {
  const descriptionSelectors = [
    ".recipe_l_descript",
    ".recipe-description",
    ".description",
    ".announce",
    ".recipe-text",
    "p"
  ];

  for (const selector of descriptionSelectors) {
    const description = normalizeText(
      container.find(selector).first().text()
    );

    if (description) {
      return description;
    }
  }

  return "";
}

function parseRecipes(html, ingredients) {
  const $ = cheerio.load(html);

  const recipes = [];
  const usedUrls = new Set();

  const recipeLinks = $(
    [
      'a[href*="/recipes/recipe.php"]',
      'a[href*="recipe.php?rid="]',
      'a[href*="/recipe/"]'
    ].join(",")
  );

  recipeLinks.each((index, element) => {
    const link = $(element);

    const url = makeAbsoluteUrl(link.attr("href"));

    if (!url) {
      return;
    }

    if (!url.includes("russianfood.com")) {
      return;
    }

    if (usedUrls.has(url)) {
      return;
    }

    const container = findRecipeContainer($, element);

    const title = getRecipeTitle($, element, container);

    if (!title) {
      return;
    }

    const description = getRecipeDescription(container);
    const image = getRecipeImage(container);
    const fullText = normalizeText(container.text());

    const match = calculateMatch(
      `${title} ${description} ${fullText}`,
      ingredients
    );

    usedUrls.add(url);

    recipes.push({
      source: SOURCE_NAME,
      title,
      url,
      image,
      description,
      score: match.score,
      matchedIngredients: match.matchedIngredients
    });
  });

  return recipes;
}

async function requestSearchPage(searchText) {
  const response = await axios.get(`${BASE_URL}/search/`, {
    params: {
      search: searchText
    },
    headers: HEADERS,
    timeout: 20000,
    responseType: "text",
    maxRedirects: 5,
    validateStatus(status) {
      return status >= 200 && status < 400;
    }
  });

  return response.data;
}

function sortRecipes(recipes) {
  return recipes.sort((firstRecipe, secondRecipe) => {
    if (secondRecipe.score !== firstRecipe.score) {
      return secondRecipe.score - firstRecipe.score;
    }

    return firstRecipe.title.localeCompare(
      secondRecipe.title,
      "ru"
    );
  });
}

export async function searchRussianFood(
  ingredients,
  options = {}
) {
  const normalizedIngredients =
    normalizeIngredients(ingredients);

  if (normalizedIngredients.length === 0) {
    return [];
  }

  const requestedLimit = Number(options.limit) || 5;
  const limit = Math.max(1, Math.min(requestedLimit, 20));

  const searchText = normalizedIngredients.join(", ");

  try {
    const html = await requestSearchPage(searchText);

    const recipes = parseRecipes(
      html,
      normalizedIngredients
    );

    return sortRecipes(recipes).slice(0, limit);
  } catch (error) {
    const status = error.response?.status;
    const message = error.message || "Неизвестная ошибка";

    console.error(
      `[${SOURCE_NAME}] Ошибка поиска:`,
      status || message
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
