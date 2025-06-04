const express = require('express');
const router = express.Router();
const { pool } = require('../db');

// Obter todas as cotações
router.get('/', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM compra_cotacao');
    res.json(rows);
  } catch (error) {
    console.error('Erro ao buscar cotações:', error);
    res.status(500).json({ message: 'Erro ao buscar cotações', error: error.message });
  }
});

// Obter solicitações disponíveis para cotação
router.get('/requests', async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT * FROM compra_solicitacao 
      WHERE status = 'Aprovado' OR status = 'Em Cotação'
    `);
    res.json(rows);
  } catch (error) {
    console.error('Erro ao buscar solicitações para cotação:', error);
    res.status(500).json({ message: 'Erro ao buscar solicitações para cotação', error: error.message });
  }
});

// Obter cotações por ID de solicitação
router.get('/by-request/:requestId', async (req, res) => {
  try {
    const { requestId } = req.params;
    const [rows] = await pool.query(`
      SELECT 
        c.fornecedor AS supplierId,
        c.solicitacao_id,
        c.itemId,
        c.fornecedor AS supplierName,
        c.preco AS price,
        c.valor_total AS totalValue,
        c.condicoes AS paymentCondition,
        c.parcelas,
        c.status,
        i.descricao AS itemName,
        i.quantidade AS quantity
      FROM compra_cotacao c
      LEFT JOIN compra_tb_itens i ON c.itemId = i.id
      LEFT JOIN compra_tb_fornecedor f ON c.fornecedor = f.id
      WHERE c.solicitacao_id = ?`,
      [requestId]
    );

    console.log('Raw database rows:', rows);

    const supplierMap = new Map();

    rows.forEach(row => {
      if (!supplierMap.has(row.supplierId)) {
        supplierMap.set(row.supplierId, {
          id: row.supplierId,
          name: row.supplierName || `Fornecedor ${row.supplierId}`,
          prazo_entrega: row.prazo_entrega,
          condicoes: row.paymentCondition,
          parcelas: row.parcelas,  // Added parcelas here
          items: []
        });
      }

      supplierMap.get(row.supplierId).items.push({
        id: row.itemId,
        itemName: row.itemName || `Item ${row.itemId}`,
        quantity: row.quantity || 1,
        price: row.price || 0,
        supplierId: row.supplierId,
        totalValue: row.totalValue,
        paymentCondition: row.paymentCondition || 'À vista',
        parcelas: row.parcelas || '1',  // Added parcelas here
      });
    });

    const result = Array.from(supplierMap.values());
    console.log('Formatted response:', result);
    
    res.json(result);
  } catch (error) {
    console.error('Erro ao buscar cotações por solicitação:', error);
    res.status(500).json({ message: 'Erro ao buscar cotações', error: error.message });
  }
});

// Criar nova cotação
router.post('/', async (req, res) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const { requestId, suppliers } = req.body;
    const createdIds = [];

    for (const supplier of suppliers) {
      // Usaremos supplier.id e supplier.name diretamente do objeto 'supplier'
      const { items } = supplier; // prazo_entrega e condicoes do fornecedor não estão sendo usados no INSERT abaixo

      for (const item of items) {

        // Verifica se já existe uma cotação para o mesmo item e fornecedor
        const [existing] = await connection.query(`
          SELECT id FROM compra_cotacao 
          WHERE solicitacao_id = ? AND itemId = ? AND fornecedor = ?`,
          [requestId, item.itemId, supplier.id]); 
 
          if (existing.length === 0) {
          const [result] = await connection.query(`
            INSERT INTO compra_cotacao 
             (solicitacao_id, itemId, fornecedor, preco, quantidade, valor_total, condicoes, status, parcelas, tipo_pagamento) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
           [
             requestId,                   
             item.itemId,                 
             supplier.name || supplier.nome, 
             item.price,                  
             item.quantity,                
             item.price * item.quantity,                       
             item.paymentCondition,        
             'Em Cotação',
             item.parcelas || 0,
             item.tipo_pagamento || item.paymentCondition || 'À vista'
           ]
          );

          createdIds.push(result.insertId);
        }
      }
    }

    await connection.query(`
      UPDATE compra_solicitacao 
      SET status = 'Em Cotação' 
      WHERE id = ? AND status = 'Aprovado'`,
      [requestId]
    );

    await connection.commit();
    res.status(201).json({ message: 'Cotação criada com sucesso!', createdIds });
  } catch (error) {
    await connection.rollback();
    console.error('Erro ao criar cotação:', error);
    res.status(500).json({ message: 'Erro ao criar cotação', error: error.message });
  } finally {
    connection.release();
  }
});

// Atualizar status da cotação
router.patch('/:id/status', async (req, res) => {
  const connection = await pool.getConnection();
  try {
    const { id } = req.params;
    const { status, approvedBy, approvalLevel } = req.body;

    await connection.beginTransaction();

    let query = 'UPDATE compra_cotacao SET status = ?';
    const params = [status];

    if (approvedBy) {
      query += ', aprovado_por = ?';
      params.push(approvedBy);
    }

    if (approvalLevel) {
      query += ', nivel_aprovacao = ?';
      params.push(approvalLevel);
    }

    query += ' WHERE id = ?';
    params.push(id);

    await connection.query(query, params);

    // Insert approval record into aprovacoes table
    const approvalInsertQuery = `
      INSERT INTO aprovacoes 
        (solicitacao_id, etapa, status, aprovado_por, nivel_aprovacao, motivo_rejeicao, data_aprovacao)
      SELECT solicitacao_id, 'Cotação', ?, ?, ?, NULL, CURDATE()
      FROM compra_cotacao WHERE id = ?
    `;
    await connection.query(approvalInsertQuery, [status, approvedBy || 'Sistema', approvalLevel || 1, id]);

    await connection.commit();

    res.json({ success: true, message: 'Status da cotação atualizado e aprovação registrada com sucesso' });
  } catch (error) {
    await connection.rollback();
    console.error('Erro ao atualizar status:', error);
    res.status(500).json({ message: 'Erro ao atualizar status', error: error.message });
  } finally {
    connection.release();
  }
});

router.post('/:requestId/finalize', async (req, res) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const { requestId } = req.params;
    const { selectedItems, approvedBy, approvalLevel } = req.body;

    const totalValue = selectedItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const supplierIds = new Set(selectedItems.map(item => item.supplierId));

    // Converter supplierIds para array
    const supplierIdsArray = Array.from(supplierIds);

    // Atualizar status das cotações aprovadas
    for (const supplierId of supplierIdsArray) {
      await connection.query(
        `UPDATE compra_cotacao 
         SET status = 'Aprovada' 
         WHERE solicitacao_id = ? AND fornecedor = ?`,
        [requestId, supplierId]
      );

      // Insert approval record for each approved supplier
      const approvalInsertQuery = `
        INSERT INTO aprovacoes 
          (solicitacao_id, etapa, status, aprovado_por, nivel_aprovacao, motivo_rejeicao, data_aprovacao)
        VALUES (?, 'Cotação', 'Aprovada', ?, ?, NULL, CURDATE())
      `;
      await connection.query(approvalInsertQuery, [requestId, approvedBy || 'Sistema', approvalLevel || 1]);
    }

    // Atualizar status das cotações rejeitadas
    if (supplierIdsArray.length > 0) {
      await connection.query(
        `UPDATE compra_cotacao 
         SET status = 'Rejeitada' 
         WHERE solicitacao_id = ? AND status = 'Em Cotação' AND fornecedor NOT IN (?)`,
        [requestId, supplierIdsArray]
      );
    }

    // Corrigir a atualização da solicitação
    await connection.query(
      `UPDATE compra_solicitacao 
       SET status = ? 
       WHERE id = ?`,
      ['Aprovado para Compra', requestId]
    );

    await connection.commit();
    res.json({ success: true, totalValue, message: 'Cotação finalizada com sucesso' });
  } catch (error) {
    await connection.rollback();
    console.error('Erro ao finalizar cotação:', error);
    res.status(500).json({ message: 'Erro ao finalizar cotação', error: error.message });
  } finally {
    connection.release();
  }
});

// Deletar cotação
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query('DELETE FROM compra_cotacao WHERE id = ?', [id]);
    res.json({ success: true, message: 'Cotação removida com sucesso' });
  } catch (error) {
    console.error('Erro ao remover cotação:', error);
    res.status(500).json({ message: 'Erro ao remover cotação', error: error.message });
  }
});

module.exports = router;