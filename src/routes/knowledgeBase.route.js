const express = require('express');
const {
  loadArticles,
  searchArticles,
  getArticleById,
} = require('../services/knowledgeBaseService');

const router = express.Router();

router.get('/', (req, res, next) => {
  try {
    const articles = loadArticles();

    return res.status(200).json({
      count: articles.length,
      articles,
    });
  } catch (error) {
    return next(error);
  }
});

router.get('/search', (req, res, next) => {
  try {
    const query = req.query.q;

    if (typeof query !== 'string' || !query.trim()) {
      return res.status(400).json({
        message: 'A non-empty search query is required.',
      });
    }

    const articles = searchArticles(query);

    return res.status(200).json({
      query: query.trim(),
      count: articles.length,
      articles,
    });
  } catch (error) {
    return next(error);
  }
});

router.get('/:id', (req, res, next) => {
  try {
    const article = getArticleById(req.params.id);

    if (!article) {
      return res.status(404).json({
        message: 'Knowledge-base article not found.',
      });
    }

    return res.status(200).json({
      article,
    });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;