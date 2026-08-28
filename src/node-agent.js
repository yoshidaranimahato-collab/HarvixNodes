const { db, save } = require("./database");

const DEFAULT_NODE = {
  id: 1,
  name: "HarvixNode-1",
  address: "127.0.0.1",

  // Configured node capacity
  ram_gb: 99999999,
  disk_tb: 3,
  cpu_vcores: 91,

  status: "online",

  created_at: new Date().toISOString()
};

function ensureDefaultNode() {
  let node = db.nodes.find(
    n => n.id === DEFAULT_NODE.id
  );

  if (!node) {
    db.nodes.push({
      ...DEFAULT_NODE
    });

    save();
    node = db.nodes.find(
      n => n.id === DEFAULT_NODE.id
    );
  }

  return node;
}

function getNode() {
  return ensureDefaultNode();
}

function getNodeStatus() {
  const node = ensureDefaultNode();

  return {
    id: node.id,
    name: node.name,
    address: node.address,

    ram_gb: node.ram_gb,
    disk_tb: node.disk_tb,
    cpu_vcores: node.cpu_vcores,

    status: node.status
  };
}

function setNodeStatus(status) {
  const node = ensureDefaultNode();

  node.status = status;

  save();

  return node;
}

module.exports = {
  ensureDefaultNode,
  getNode,
  getNodeStatus,
  setNodeStatus
};
