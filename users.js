
const express = require('express');
const router = express.Router();
const { pool } = require('../db');

// Função para obter permissões baseado no nível de acesso
const getPermissoesByNivel = (nivel) => {
  const nivelLower = nivel.toLowerCase();
  
  // Mapeamento de níveis para permissões
  const permissoes = {
    'verde': {
      nivel: 'verde',
      descricao: 'Gerência / Diretoria',
      permissoes: {
        compra_impeditivos: 1,
        compra_consumo: 1,
        compra_estoque: 1,
        compra_locais: 1,
        compra_investimentos: 1,
        compra_alojamentos: 1,
        compra_supermercados: 1,
        aprova_solicitacao: 1
      }
    },
    'azul': {
      nivel: 'azul',
      descricao: 'Supervisão / Segurança',
      permissoes: {
        compra_impeditivos: 1,
        compra_consumo: 1,
        compra_estoque: 1,
        compra_locais: 1,
        compra_investimentos: 1,
        compra_alojamentos: 0,
        compra_supermercados: 0,
        aprova_solicitacao: 1
      }
    },
    'marrom': {
      nivel: 'marrom',
      descricao: 'Coordenação',
      permissoes: {
        compra_impeditivos: 1,
        compra_consumo: 1,
        compra_estoque: 1,
        compra_locais: 1,
        compra_investimentos: 0,
        compra_alojamentos: 0,
        compra_supermercados: 1,
        aprova_solicitacao: 1
      }
    },
    'amarelo': {
      nivel: 'amarelo',
      descricao: 'Levantador / Encarregado',
      permissoes: {
        compra_impeditivos: 1,
        compra_consumo: 1,
        compra_estoque: 1,
        compra_locais: 0,
        compra_investimentos: 0,
        compra_alojamentos: 0,
        compra_supermercados: 0,
        aprova_solicitacao: 0
      }
    }
  };

  return permissoes[nivelLower] || null;
};

// Função para obter nível de acesso baseado no cargo (função de compatibilidade)
const getNivelAcessoByCargo = (cargo) => {
  const cargoLower = cargo.toLowerCase();
  
  // Mapeamento de cargos para níveis de acesso
  const cargoParaNivel = {
    'administrador': 'verde',
    'diretor': 'verde',
    'diretoria': 'verde',
    'gerente': 'verde',
    'supervisor': 'azul',
    'segurança': 'azul',
    'coordenador': 'marrom',
    'coordenação': 'marrom',
    'comprador': 'amarelo',
    'levantador': 'amarelo',
    'encarregado': 'amarelo'
  };
  
  const nivel = cargoParaNivel[cargoLower] || 'amarelo';
  return getPermissoesByNivel(nivel);
};
// GET TODOS FUNCIONÁRIOS
router.get('/', async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT 
        f.id, f.nome, f.email, f.cargo, f.status as ativo, 
        f.departamento, f.matricula,
        n.descricao AS nivel_acesso, n.nivel,
        n.compra_impeditivos, n.compra_consumo, n.compra_estoque,
        n.compra_locais, n.compra_investimentos, n.compra_alojamentos,
        n.compra_supermercados, n.aprova_solicitacao
      FROM tb_funcionarios f 
      LEFT JOIN nivel_acesso n ON f.matricula = n.mat_funcionario
    `);
    res.json(rows);
  } catch (err) {
    console.error('Erro ao buscar funcionários:', err);
    res.status(500).json({ message: 'Erro ao buscar funcionários' });
  }
});

// GET FUNCIONÁRIO POR ID
router.get('/:id', async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT 
        f.id, f.nome, f.email, f.cargo, f.status as ativo, 
        f.departamento, f.matricula,
        n.descricao AS nivel_acesso, n.nivel,
        n.compra_impeditivos, n.compra_consumo, n.compra_estoque,
        n.compra_locais, n.compra_investimentos, n.compra_alojamentos,
        n.compra_supermercados, n.aprova_solicitacao
      FROM tb_funcionarios f 
      LEFT JOIN nivel_acesso n ON f.matricula = n.mat_funcionario
      WHERE f.id = ?
    `, [req.params.id]);

    if (rows.length === 0) {
      return res.status(404).json({ message: 'Funcionário não encontrado' });
    }

    res.json(rows[0]);
  } catch (err) {
    console.error('Erro ao buscar funcionário:', err);
    res.status(500).json({ message: 'Erro ao buscar funcionário' });
  }
});
// LOGIN
router.post('/login', async (req, res) => {
  const { email, senha } = req.body;
  try {
    const [users] = await pool.query(`
      SELECT 
        f.id, f.nome, f.email, f.cargo, f.status, 
        f.departamento, f.matricula,
        n.descricao AS nivel_acesso, n.nivel,
        n.compra_impeditivos, n.compra_consumo, n.compra_estoque,
        n.compra_locais, n.compra_investimentos, n.compra_alojamentos,
        n.compra_supermercados, n.aprova_solicitacao
      FROM tb_funcionarios f
      LEFT JOIN nivel_acesso n ON f.matricula = n.mat_funcionario
      WHERE f.email = ? AND f.senha = ? AND f.status = 1
    `, [email, senha]);

    if (users.length === 0) {
      return res.status(401).json({ success: false, message: 'Credenciais inválidas ou usuário inativo' });
    }

    const user = users[0];
    
    user.permissoes = {
      compra_impeditivos: user.compra_impeditivos,
      compra_consumo: user.compra_consumo,
      compra_estoque: user.compra_estoque,
      compra_locais: user.compra_locais,
      compra_investimentos: user.compra_investimentos,
      compra_alojamentos: user.compra_alojamentos,
      compra_supermercados: user.compra_supermercados,
      aprova_solicitacao: user.aprova_solicitacao
    };


    res.json({ 
      success: true, 
      user: {
        id: user.id,
        nome: user.nome,
        email: user.email,
        cargo: user.cargo,
        nivel_acesso: user.nivel_acesso,
        nivel: user.nivel,
        departamento: user.departamento,
        matricula: user.matricula,
        permissoes: user.permissoes
      }
    });
  } catch (err) {
    console.error('Erro ao realizar login:', err);
    res.status(500).json({ success: false, message: 'Erro ao realizar login' });
  }
});

// ALTERAR SENHA
router.patch('/:id/senha', async (req, res) => {
  const { senhaAtual, novaSenha } = req.body;
  
  if (!senhaAtual || !novaSenha) {
    return res.status(400).json({ success: false, message: 'Senhas não informadas' });
  }
  
  try {
    // Verificar se a senha atual está correta
    const [user] = await pool.query('SELECT senha FROM tb_funcionarios WHERE id = ?', [req.params.id]);
    
    if (user.length === 0) {
      return res.status(404).json({ success: false, message: 'Usuário não encontrado' });
    }
    
    if (user[0].senha !== senhaAtual) {
      return res.status(400).json({ success: false, message: 'Senha atual incorreta' });
    }
    
    // Atualizar senha
    await pool.query('UPDATE tb_funcionarios SET senha = ? WHERE id = ?', [novaSenha, req.params.id]);
    
    res.json({ success: true, message: 'Senha alterada com sucesso' });
  } catch (error) {
    console.error('Erro ao alterar senha:', error);
    res.status(500).json({ success: false, message: 'Erro ao alterar senha' });
  }
});

// POST CRIAR FUNCIONÁRIO
router.post('/', async (req, res) => {
  console.log('Dados recebidos:', req.body);
  
  const connection = await pool.getConnection();
  
  try {
    await connection.beginTransaction();

    const { nome, email, cargo, status, departamento, senha, matricula, ativo, nivelAcesso } = req.body;

    // Use status OR ativo flag
    const isActive = status !== undefined ? (status === 1 || status === true) : 
                    (ativo !== undefined ? ativo : true);

    console.log('Dados processados:', { 
      nome, 
      email, 
      cargo, 
      status: isActive ? 1 : 0, 
      departamento, 
      matricula,
      nivelAcesso
    });

    // Validar campos obrigatórios
    if (!nome || !email || !cargo || !senha || !matricula) {
      return res.status(400).json({ 
        success: false, 
        message: 'Campos obrigatórios não preenchidos' 
      });
    }

    // Verificar se já existe usuário com mesmo email ou matrícula
    const [existingUsers] = await connection.query(
      'SELECT * FROM tb_funcionarios WHERE email = ? OR matricula = ?',
      [email, matricula]
    );

    if (existingUsers.length > 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'Email ou matrícula já cadastrados' 
      });
    }

    // Obter permissões baseado no nível de acesso selecionado ou cargo
    let permissoesInfo;
    if (nivelAcesso) {
      permissoesInfo = getPermissoesByNivel(nivelAcesso);
    } else {
      permissoesInfo = getNivelAcessoByCargo(cargo);
    }
    
    if (!permissoesInfo) {
      return res.status(400).json({ 
        success: false, 
        message: 'Nível de acesso inválido' 
      });
    }

    console.log('Nível de acesso:', permissoesInfo);

    // Inserir funcionário
    const [result] = await connection.query(
      'INSERT INTO tb_funcionarios (nome, email, cargo, status, departamento, senha, matricula) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [nome, email, cargo, isActive ? 1 : 0, departamento || null, senha, matricula]
    );

    console.log('Funcionário inserido com ID:', result.insertId);

    try {
      // Verificar estrutura da tabela nivel_acesso
      const [tableInfo] = await connection.query('DESCRIBE nivel_acesso');
      console.log('Estrutura da tabela nivel_acesso:', tableInfo);

      // Verificar se já existe um registro para a matrícula
      const [existingNivel] = await connection.query(
        'SELECT * FROM nivel_acesso WHERE mat_funcionario = ?',
        [matricula]
      );

      if (existingNivel.length > 0) {
        // Atualizar nível de acesso existente
        if (tableInfo.some(column => column.Field === 'permissoes')) {
          // Nova estrutura
          await connection.query(
            'UPDATE nivel_acesso SET nivel = ?, descricao = ?, permissoes = ? WHERE mat_funcionario = ?',
            [permissoesInfo.nivel, permissoesInfo.descricao, JSON.stringify(permissoesInfo.permissoes), matricula]
          );
        } else {
          // Estrutura antiga
          await connection.query(
            `UPDATE nivel_acesso SET 
              nivel = ?, descricao = ?,
              compra_impeditivos = ?, compra_consumo = ?, compra_estoque = ?,
              compra_locais = ?, compra_investimentos = ?, compra_alojamentos = ?,
              compra_supermercados = ?, aprova_solicitacao = ?
             WHERE mat_funcionario = ?`,
            [
              permissoesInfo.nivel, permissoesInfo.descricao,
              permissoesInfo.permissoes.compra_impeditivos,
              permissoesInfo.permissoes.compra_consumo,
              permissoesInfo.permissoes.compra_estoque,
              permissoesInfo.permissoes.compra_locais,
              permissoesInfo.permissoes.compra_investimentos,
              permissoesInfo.permissoes.compra_alojamentos,
              permissoesInfo.permissoes.compra_supermercados,
              permissoesInfo.permissoes.aprova_solicitacao,
              matricula
            ]
          );
        }
      } else {
        // Inserir nível de acesso
        if (tableInfo.some(column => column.Field === 'permissoes')) {
          // Nova estrutura
          await connection.query(
            'INSERT INTO nivel_acesso (mat_funcionario, nivel, descricao, permissoes) VALUES (?, ?, ?, ?)',
            [matricula, permissoesInfo.nivel, permissoesInfo.descricao, JSON.stringify(permissoesInfo.permissoes)]
          );
        } else {
          // Estrutura antiga
          await connection.query(
            `INSERT INTO nivel_acesso (
              mat_funcionario, nivel, descricao,
              compra_impeditivos, compra_consumo, compra_estoque,
              compra_locais, compra_investimentos, compra_alojamentos,
              compra_supermercados, aprova_solicitacao
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
           matricula,
      permissoesInfo.nivel,
      permissoesInfo.descricao,
      permissoesInfo.permissoes.compra_impeditivos,
      permissoesInfo.permissoes.compra_consumo,
      permissoesInfo.permissoes.compra_estoque,
      permissoesInfo.permissoes.compra_locais,
      permissoesInfo.permissoes.compra_investimentos,
      permissoesInfo.permissoes.compra_alojamentos,
      permissoesInfo.permissoes.compra_supermercados,
      permissoesInfo.permissoes.aprova_solicitacao
            ]
          );
        }
      }
    } catch (tableError) {
      console.error('Erro ao manipular nivel_acesso (continuando):', tableError);
      // Continue mesmo se houver erro com a tabela nivel_acesso
    }

    console.log('Nível de acesso inserido para matrícula:', matricula);

    await connection.commit();

    // Buscar usuário criado
    const [newUser] = await connection.query(
      `SELECT f.id, f.nome, f.email, f.cargo, f.status as ativo, f.departamento, f.matricula,
              n.descricao AS nivel_acesso, n.nivel
       FROM tb_funcionarios f
       LEFT JOIN nivel_acesso n ON f.matricula = n.mat_funcionario
       WHERE f.id = ?`,
      [result.insertId]
    );

    console.log('Usuário criado:', newUser[0]);

    res.status(201).json({ 
      success: true, 
      id: result.insertId,
      user: newUser.length > 0 ? newUser[0] : null,
      message: 'Usuário criado com sucesso'
    });
  } catch (err) {
    await connection.rollback();
    console.error('Erro ao criar funcionário:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Erro ao criar funcionário: ' + err.message 
    });
  } finally {
    connection.release();
  }
});

// ATUALIZAR FUNCIONÁRIO
router.put('/:id', async (req, res) => {
  const { nome, email, cargo, status, departamento, senha, matricula, ativo, nivelAcesso } = req.body;
  
  // Use status OR ativo flag
  const isActive = status !== undefined ? (status === 1 || status === true) : 
                  (ativo !== undefined ? ativo : true);
  
  const connection = await pool.getConnection();
  
  try {
    await connection.beginTransaction();
    
    let query = `
      UPDATE tb_funcionarios 
      SET nome = ?, email = ?, cargo = ?, status = ?, departamento = ?, matricula = ?
      WHERE id = ?
    `;
    let params = [nome, email, cargo, isActive ? 1 : 0, departamento, matricula, req.params.id];

    if (senha) {
      query = `
        UPDATE tb_funcionarios 
        SET nome = ?, email = ?, cargo = ?, status = ?, departamento = ?, matricula = ?, senha = ?
        WHERE id = ?
      `;
      params = [nome, email, cargo, isActive ? 1 : 0, departamento, matricula, senha, req.params.id];
    }

    await connection.query(query, params);
    
    // Atualizar o nível de acesso
    // Obter permissões baseado no nível de acesso selecionado ou cargo
    let permissoesInfo;
    if (nivelAcesso) {
      permissoesInfo = getPermissoesByNivel(nivelAcesso);
    } else {
      permissoesInfo = getNivelAcessoByCargo(cargo);
    }
    
    if (permissoesInfo) {
      try {
        const [exists] = await connection.query(
          'SELECT 1 FROM nivel_acesso WHERE mat_funcionario = ?',
          [matricula]
        );

        if (exists.length > 0) {
          // Verificar estrutura da tabela nivel_acesso
          const [tableInfo] = await connection.query('DESCRIBE nivel_acesso');
          
          if (tableInfo.some(column => column.Field === 'permissoes')) {
            // Nova estrutura
            await connection.query(
              'UPDATE nivel_acesso SET nivel = ?, descricao = ?, permissoes = ? WHERE mat_funcionario = ?',
              [permissoesInfo.nivel, permissoesInfo.descricao, JSON.stringify(permissoesInfo.permissoes), matricula]
            );
          } else {
            // Estrutura antiga
            await connection.query(`
              UPDATE nivel_acesso SET
                nivel = ?,
                descricao = ?,
                compra_impeditivos = ?,
                compra_consumo = ?,
                compra_estoque = ?,
                compra_locais = ?,
                compra_investimentos = ?,
                compra_alojamentos = ?,
                compra_supermercados = ?,
                aprova_solicitacao = ?
              WHERE mat_funcionario = ?
            `, [
              permissoesInfo.nivel,
              permissoesInfo.descricao,
              permissoesInfo.permissoes.compra_impeditivos,
              permissoesInfo.permissoes.compra_consumo,
              permissoesInfo.permissoes.compra_estoque,
              permissoesInfo.permissoes.compra_locais,
              permissoesInfo.permissoes.compra_investimentos,
              permissoesInfo.permissoes.compra_alojamentos,
              permissoesInfo.permissoes.compra_supermercados,
              permissoesInfo.permissoes.aprova_solicitacao,
              matricula
            ]);
          }
        } else {
          // Inserir
          // Verificar estrutura da tabela nivel_acesso
          const [tableInfo] = await connection.query('DESCRIBE nivel_acesso');
          
          if (tableInfo.some(column => column.Field === 'permissoes')) {
            // Nova estrutura
            await connection.query(
              'INSERT INTO nivel_acesso (mat_funcionario, nivel, descricao, permissoes) VALUES (?, ?, ?, ?)',
              [matricula, permissoesInfo.nivel, permissoesInfo.descricao, JSON.stringify(permissoesInfo.permissoes)]
            );
          } else {
            // Estrutura antiga
            await connection.query(`
              INSERT INTO nivel_acesso (
                mat_funcionario, nivel, descricao, 
                compra_impeditivos, compra_consumo, compra_estoque,
                compra_locais, compra_investimentos, compra_alojamentos,
                compra_supermercados, aprova_solicitacao
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
              matricula, permissoesInfo.nivel, permissoesInfo.descricao,
              permissoesInfo.permissoes.compra_impeditivos,
              permissoesInfo.permissoes.compra_consumo,
              permissoesInfo.permissoes.compra_estoque,
              permissoesInfo.permissoes.compra_locais,
              permissoesInfo.permissoes.compra_investimentos,
              permissoesInfo.permissoes.compra_alojamentos,
              permissoesInfo.permissoes.compra_supermercados,
              permissoesInfo.permissoes.aprova_solicitacao
            ]);
          }
        }
      } catch (nivelError) {
        console.error('Erro ao atualizar nível de acesso (não crítico):', nivelError);
        // Não falhar a requisição principal por causa deste erro
      }
    }
    
    await connection.commit();
    res.status(200).json({ success: true, message: 'Funcionário atualizado com sucesso' });
  } catch (err) {
    await connection.rollback();
    console.error('Erro ao atualizar funcionário:', err);
    res.status(500).json({ success: false, message: 'Erro ao atualizar funcionário' });
  } finally {
    connection.release();
  }
});

// Alterar status do usuário (ativar/desativar)
router.patch('/:id/status', async (req, res) => {
  const { ativo, status } = req.body;
  const id = req.params.id;
  
  // Use ativo OR status
  const isActive = ativo !== undefined ? ativo : (status !== undefined ? (status === 1 || status === true) : null);
  
  if (isActive === null) {
    return res.status(400).json({ success: false, message: 'Status não informado' });
  }
  
  try {
    // Verificar se usuário existe
    const [existingUser] = await pool.query('SELECT id FROM tb_funcionarios WHERE id = ?', [id]);
    
    if (existingUser.length === 0) {
      return res.status(404).json({ success: false, message: 'Usuário não encontrado' });
    }
    
    // Atualizar status
    await pool.query('UPDATE tb_funcionarios SET status = ? WHERE id = ?', [isActive ? 1 : 0, id]);
    
    res.json({ success: true, message: 'Status do usuário atualizado com sucesso' });
  } catch (error) {
    console.error('Erro ao atualizar status do usuário:', error);
    res.status(500).json({ success: false, message: 'Erro ao atualizar status do usuário' });
  }
});

// CRIAR NÍVEL DE ACESSO
router.post('/nivel-acesso', async (req, res) => {
  const {
    matricula,
    descricao,
    compra_impeditivos,
    compra_consumo,
    compra_estoque,
    compra_locais,
    compra_investimentos,
    compra_alojamentos,
    compra_supermercados,
    aprova_solicitacao
  } = req.body;

  try {
    // Verifica se já existe um nível de acesso para a matrícula
    const [exists] = await pool.query(
      `SELECT 1 FROM nivel_acesso WHERE mat_funcionario = ?`,
      [matricula]
    );

    if (exists.length > 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'Nível de acesso já existe para essa matrícula' 
      });
    }

    await pool.query(`
      INSERT INTO nivel_acesso (
        mat_funcionario,
        descricao,
        compra_impeditivos,
        compra_consumo,
        compra_estoque,
        compra_locais,
        compra_investimentos,
        compra_alojamentos,
        compra_supermercados,
        aprova_solicitacao
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      matricula,
      descricao,
      compra_impeditivos ? 1 : 0,
      compra_consumo ? 1 : 0,
      compra_estoque ? 1 : 0,
      compra_locais ? 1 : 0,
      compra_investimentos ? 1 : 0,
      compra_alojamentos ? 1 : 0,
      compra_supermercados ? 1 : 0,
      aprova_solicitacao ? 1 : 0
    ]);

    res.status(201).json({ success: true, message: 'Nível de acesso cadastrado com sucesso' });
  } catch (err) {
    console.error('Erro ao inserir nível de acesso:', err);
    res.status(500).json({ success: false, message: 'Erro ao inserir nível de acesso' });
  }
});

// ATUALIZAR NÍVEL DE ACESSO
router.put('/nivel-acesso/:matricula', async (req, res) => {
  const {
    descricao,
    compra_impeditivos,
    compra_consumo,
    compra_estoque,
    compra_locais,
    compra_investimentos,
    compra_alojamentos,
    compra_supermercados,
    aprova_solicitacao
  } = req.body;

  try {
    await pool.query(`
      UPDATE nivel_acesso SET
        descricao = ?,
        compra_impeditivos = ?,
        compra_consumo = ?,
        compra_estoque = ?,
        compra_locais = ?,
        compra_investimentos = ?,
        compra_alojamentos = ?,
        compra_supermercados = ?,
        aprova_solicitacao = ?
      WHERE mat_funcionario = ?
    `, [
      descricao,
      compra_impeditivos ? 1 : 0,
      compra_consumo ? 1 : 0,
      compra_estoque ? 1 : 0,
      compra_locais ? 1 : 0,
      compra_investimentos ? 1 : 0,
      compra_alojamentos ? 1 : 0,
      compra_supermercados ? 1 : 0,
      aprova_solicitacao ? 1 : 0,
      req.params.matricula
    ]);

    res.status(200).json({ success: true, message: 'Nível de acesso atualizado com sucesso' });
  } catch (err) {
    console.error('Erro ao atualizar nível de acesso:', err);
    res.status(500).json({ success: false, message: 'Erro ao atualizar nível de acesso' });
  }
});

module.exports = router;
