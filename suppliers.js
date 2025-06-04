
const express = require('express');
const router = express.Router();
const { pool } = require('../db');

// Função para mapear campos do banco para o formato esperado no frontend
const mapSupplierFields = (supplier) => {
  return {
    id: supplier.id,
    nome: supplier.nome_fornecedor,
    categoria: supplier.Categoria || supplier.categoria,
    contato: supplier.contato,
    telefone: supplier.telefone,
    email: supplier.email,
    endereco: supplier.endereco,
    cnpj: supplier.cnpj,
    cidade: supplier.cidade,
    estado: supplier.estado,
    cep: supplier.cep,
    observacoes: supplier.observacoes
  };
};

// Obter todos os fornecedores
router.get('/', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM compra_tb_fornecedor');
    const mappedSuppliers = rows.map(mapSupplierFields);
    res.json(mappedSuppliers);
  } catch (error) {
    console.error('Erro ao buscar fornecedores:', error);
    res.status(500).json({ message: 'Erro ao buscar fornecedores', error: error.message });
  }
});

// Obter um fornecedor por ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const [rows] = await pool.query('SELECT * FROM compra_tb_fornecedor WHERE id = ?', [id]);
    
    if (rows.length === 0) {
      return res.status(404).json({ message: 'Fornecedor não encontrado' });
    }
    
    res.json(mapSupplierFields(rows[0]));
  } catch (error) {
    console.error(`Erro ao buscar fornecedor com ID ${req.params.id}:`, error);
    res.status(500).json({ message: 'Erro ao buscar fornecedor', error: error.message });
  }
});

// Criar novo fornecedor
router.post('/', async (req, res) => {
  try {
    const supplierData = req.body;
    
    const [result] = await pool.query(
      `INSERT INTO compra_tb_fornecedor (
        nome_fornecedor, 
        cnpj, 
        Categoria, 
        contato, 
        telefone, 
        email, 
        endereco,
        cidade,
        estado,
        cep,
        observacoes
      ) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        supplierData.nome,
        supplierData.cnpj,
        supplierData.categoria,
        supplierData.contato,
        supplierData.telefone,
        supplierData.email,
        supplierData.endereco,
        supplierData.cidade,
        supplierData.estado,
        supplierData.cep,
        supplierData.observacoes
      ]
    );
    
    res.status(201).json({ id: result.insertId, message: 'Fornecedor criado com sucesso' });
  } catch (error) {
    console.error('Erro ao criar fornecedor:', error);
    res.status(500).json({ message: 'Erro ao criar fornecedor', error: error.message });
  }
});

// Atualizar fornecedor
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const supplierData = req.body;
    
    await pool.query(
      `UPDATE compra_tb_fornecedor 
       SET 
        nome_fornecedor = ?, 
        cnpj = ?,
        Categoria = ?, 
        contato = ?, 
        telefone = ?, 
        email = ?, 
        endereco = ?,
        cidade = ?,
        estado = ?,
        cep = ?,
        observacoes = ?
       WHERE id = ?`,
      [
        supplierData.nome,
        supplierData.cnpj,
        supplierData.categoria,
        supplierData.contato,
        supplierData.telefone,
        supplierData.email,
        supplierData.endereco,
        supplierData.cidade,
        supplierData.estado,
        supplierData.cep,
        supplierData.observacoes,
        id
      ]
    );
    
    res.json({ success: true, message: 'Fornecedor atualizado com sucesso' });
  } catch (error) {
    console.error(`Erro ao atualizar fornecedor ${req.params.id}:`, error);
    res.status(500).json({ message: 'Erro ao atualizar fornecedor', error: error.message });
  }
});

// Excluir fornecedor
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query('DELETE FROM compra_tb_fornecedor WHERE id = ?', [id]);
    res.json({ success: true, message: 'Fornecedor excluído com sucesso' });
  } catch (error) {
    console.error(`Erro ao excluir fornecedor ${req.params.id}:`, error);
    res.status(500).json({ message: 'Erro ao excluir fornecedor', error: error.message });
  }
});

module.exports = router;
