const express = require('express');
const router = express.Router();
const { pool } = require('../db');

// Obter todos os centros de custo
router.get('/', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT id_cc, descricao FROM compra_centro_custo ORDER BY id_cc');
    res.json(rows);
  } catch (error) {
    console.error('Erro ao buscar centros de custo:', error);
    res.status(500).json({ success: false, message: 'Erro ao buscar centros de custo' });
  }
});

// Obter centro de custo por ID
router.get('/:id_cc', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM compra_centro_custo WHERE id_cc = ?', [req.params.id_cc]);

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Centro de custo não encontrado' });
    }

    res.json(rows[0]);
  } catch (error) {
    console.error('Erro ao buscar centro de custo:', error);
    res.status(500).json({ success: false, message: 'Erro ao buscar centro de custo' });
  }
});

// Criar novo centro de custo
router.post('/', async (req, res) => {
  const { id, descricao, id_cc, ativo } = req.body;

  if (!id_cc || !descricao) {
    return res.status(400).json({ success: false, message: 'Código (id_cc) e descrição são obrigatórios' });
  }

  try {
    const [existingCenter] = await pool.query('SELECT id FROM compra_centro_custo WHERE id_cc = ?', [id_cc]);

    if (existingCenter.length > 0) {
      return res.status(400).json({ success: false, message: 'Código já cadastrado' });
    }

    const [result] = await pool.query(
      'INSERT INTO compra_centro_custo ( descricao, id_cc, ativo) VALUES (?, ?, ?)',
      [descricao, id_cc, ativo ? 1 : 0]
    );

    res.status(201).json({ success: true, id: result.insertId });
  } catch (error) {
    console.error('Erro ao criar centro de custo:', error);
    res.status(500).json({ success: false, message: 'Erro ao criar centro de custo' });
  }
});

// Atualizar centro de custo
router.put('/:id_cc', async (req, res) => {
  const { id, descricao, ativo } = req.body;
  const { id_cc } = req.params;

  if (!id || !descricao) {
    return res.status(400).json({ success: false, message: 'Código (id) e descrição são obrigatórios' });
  }

  try {
    const [existingCenter] = await pool.query('SELECT id FROM compra_centro_custo WHERE id_cc = ?', [id_cc]);

    if (existingCenter.length === 0) {
      return res.status(404).json({ success: false, message: 'Centro de custo não encontrado' });
    }

    await pool.query(
      'UPDATE compra_centro_custo SET id = ?, descricao = ?, ativo = ? WHERE id_cc = ?',
      [id, descricao, ativo ? 1 : 0, id_cc]
    );

    res.json({ success: true, message: 'Centro de custo atualizado com sucesso' });
  } catch (error) {
    console.error('Erro ao atualizar centro de custo:', error);
    res.status(500).json({ success: false, message: 'Erro ao atualizar centro de custo' });
  }
});

// Remover centro de custo
router.delete('/:id_cc', async (req, res) => {
  try {
    const [result] = await pool.query('DELETE FROM compra_centro_custo WHERE id_cc = ?', [req.params.id_cc]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Centro de custo não encontrado' });
    }

    res.json({ success: true, message: 'Centro de custo removido com sucesso' });
  } catch (error) {
    console.error('Erro ao remover centro de custo:', error);
    res.status(500).json({ success: false, message: 'Erro ao remover centro de custo' });
  }
});

module.exports = router;
