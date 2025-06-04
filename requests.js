const express = require('express');
const router = express.Router();
const { pool } = require('../db');

// Obter todas as solicitações
router.get('/', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM compra_solicitacao');
    res.json(rows);
  } catch (error) {
    console.error('Erro ao buscar solicitações:', error);
    res.status(500).json({ message: 'Erro ao buscar solicitações', error: error.message });
  }
});

// Obter uma solicitação por ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const [request] = await pool.query('SELECT * FROM compra_solicitacao WHERE id = ?', [id]);
    
    if (request.length === 0) {
      return res.status(404).json({ message: 'Solicitação não encontrada' });
    }
    
    // Buscar itens relacionados
    const [items] = await pool.query('SELECT * FROM compra_tb_itens WHERE solicitacao_id = ?', [id]);
    
    // Buscar aprovações relacionadas
    const [approvals] = await pool.query('SELECT * FROM aprovacoes WHERE solicitacao_id = ?', [id]);
    
    // Buscar cotações relacionadas
    const [quotes] = await pool.query('SELECT * FROM compra_cotacao WHERE solicitacao_id = ?', [id]);
    
    res.json({
      ...request[0],
      items,
      approvals,
      quotes
    });
  } catch (error) {
    console.error(`Erro ao buscar solicitação com ID ${req.params.id}:`, error);
    res.status(500).json({ message: 'Erro ao buscar solicitação', error: error.message });
  }
});

// Criar nova solicitação
router.post('/', async (req, res) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    
    const { requestData, items } = req.body;
    
    // Inserir solicitação principal
    const [result] = await connection.query(
      `INSERT INTO compra_solicitacao 
       (nome_solicitante, aplicacao, centro_custo, data_solicitacao, 
        local_entrega, prazo_entrega, categoria, motivo, prioridade, status) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        requestData.requesterName,
        requestData.application,
        requestData.costCenter,
        new Date().toISOString().split('T')[0],
        requestData.deliveryLocation,
        requestData.deliveryDeadline,
        requestData.category,
        requestData.reason,
        requestData.priority,
        'Solicitado'
      ]
    );
    
    const requestId = result.insertId;
    
    // Inserir itens
    for (const item of items) {
      await connection.query(
        `INSERT INTO compra_tb_itens (descricao, quantidade, solicitacao_id, id_solicitante) 
         VALUES (?, ?, ?, ?)`,
        [item.description, item.quantity, requestId, 1] // 1 é um ID de solicitante padrão
      );
    }
    
    await connection.commit();
    res.status(201).json({ id: requestId, message: 'Solicitação criada com sucesso' });
  } catch (error) {
    await connection.rollback();
    console.error('Erro ao criar solicitação:', error);
    res.status(500).json({ message: 'Erro ao criar solicitação', error: error.message });
  } finally {
    connection.release();
  }
});

// Atualizar detalhes da solicitação
router.put('/:id', async (req, res) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    
    const { id } = req.params;
    const updateData = req.body;
    
    // Verificar se a solicitação existe
    const [existingRequest] = await connection.query(
      'SELECT * FROM compra_solicitacao WHERE id = ?',
      [id]
    );
    
    if (existingRequest.length === 0) {
      return res.status(404).json({ message: 'Solicitação não encontrada' });
    }
    
    // Atualizar dados da solicitação
    await connection.query(
      `UPDATE compra_solicitacao SET 
       aplicacao = ?, 
       motivo = ?, 
       prioridade = ?, 
       prazo_entrega = ?, 
       local_entrega = ? 
       WHERE id = ?`,
      [
        updateData.aplicacao || existingRequest[0].aplicacao,
        updateData.motivo || existingRequest[0].motivo,
        updateData.prioridade || existingRequest[0].prioridade,
        updateData.prazo_entrega || existingRequest[0].prazo_entrega,
        updateData.local_entrega || existingRequest[0].local_entrega,
        id
      ]
    );
    
    await connection.commit();
    res.json({ success: true, message: 'Solicitação atualizada com sucesso' });
  } catch (error) {
    await connection.rollback();
    console.error(`Erro ao atualizar solicitação ${req.params.id}:`, error);
    res.status(500).json({ message: 'Erro ao atualizar solicitação', error: error.message });
  } finally {
    connection.release();
  }
});

// Atualizar status da solicitação
router.patch('/:id/status', async (req, res) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    
    const { id } = req.params;
    const { status, approvalData } = req.body;
    
    // Atualizar status da solicitação
    await connection.query(
      'UPDATE compra_solicitacao SET status = ? WHERE id = ?',
      [status, id]
    );
    
    // Adicionar ou atualizar registro de aprovação, se fornecido
    if (approvalData) {
      const etapa = approvalData.etapa || 'Solicitação';
      // Verificar se já existe um registro de aprovação para esta solicitação e etapa
      const [existingApproval] = await connection.query(
        'SELECT * FROM aprovacoes WHERE solicitacao_id = ? AND etapa = ?',
        [id, etapa]
      );

      if (existingApproval.length > 0) {
        // Atualizar registro existente
        await connection.query(
          `UPDATE aprovacoes SET 
            status = ?, 
            aprovado_por = ?, 
            nivel_aprovacao = ?, 
            motivo_rejeicao = ?, 
            data_aprovacao = ? 
          WHERE solicitacao_id = ? `,
          [
            approvalData.status || status,
            approvalData.aprovado_por || 'Sistema',
            approvalData.nivel_aprovacao || 1,
            approvalData.motivo_rejeicao || null,
            new Date().toISOString().split('T')[0],
            id,
            etapa
          ]
        );
      } else {
        // Inserir novo registro
        await connection.query(
          `INSERT INTO aprovacoes 
           (solicitacao_id, etapa, status, aprovado_por, nivel_aprovacao, motivo_rejeicao, data_aprovacao) 
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            id,
            etapa,
            approvalData.status || status,
            approvalData.aprovado_por || 'Sistema',
            approvalData.nivel_aprovacao || 1,
            approvalData.motivo_rejeicao || null,
            new Date().toISOString().split('T')[0]
          ]
        );
      }
    }
    
    await connection.commit();
    res.json({ success: true, message: 'Status atualizado com sucesso' });
  } catch (error) {
    await connection.rollback();
    console.error(`Erro ao atualizar status da solicitação ${req.params.id}:`, error);
    res.status(500).json({ message: 'Erro ao atualizar status', error: error.message });
  } finally {
    connection.release();
  }
});

module.exports = router;
