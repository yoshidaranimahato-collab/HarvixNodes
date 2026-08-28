/*
 * HarvixPanel Server Resource Manager
 *
 * Normal users:
 * RAM  = maximum 4096 MB
 * Disk = maximum 5120 MB
 * CPU  = maximum 1 vCore
 *
 * Admin users can create servers
 * with higher resource limits.
 */

function validateLimits(body, isAdmin = false) {

  const ram = Number(body.ram_mb);
  const disk = Number(body.disk_mb);
  const cpu = Number(body.cpu_vcpu);

  /*
   * Basic validation
   */

  if (
    !Number.isFinite(ram) ||
    !Number.isFinite(disk) ||
    !Number.isFinite(cpu)
  ) {
    throw new Error(
      "Invalid resource values."
    );
  }

  if (ram <= 0) {
    throw new Error(
      "RAM must be greater than 0."
    );
  }

  if (disk <= 0) {
    throw new Error(
      "Disk must be greater than 0."
    );
  }

  if (cpu <= 0) {
    throw new Error(
      "CPU must be greater than 0."
    );
  }

  /*
   * Normal-user limits
   */

  if (!isAdmin) {

    if (ram > 4096) {
      throw new Error(
        "Normal user RAM limit is 4096 MB."
      );
    }

    if (disk > 5120) {
      throw new Error(
        "Normal user disk limit is 5120 MB."
      );
    }

    if (cpu > 1) {
      throw new Error(
        "Normal user CPU limit is 1 vCore."
      );
    }
  }

  return {
    ram,
    disk,
    cpu
  };
}


/*
 * Check whether a server can fit
 * inside a node's available resources.
 */

function checkNodeCapacity(
  server,
  node
) {

  const usedRam =
    Number(node.used_ram_mb || 0);

  const usedDisk =
    Number(node.used_disk_mb || 0);

  const usedCpu =
    Number(node.used_cpu_vcpu || 0);

  const totalRam =
    Number(node.ram_mb || 0);

  const totalDisk =
    Number(node.disk_mb || 0);

  const totalCpu =
    Number(node.cpu_vcpu || 0);

  const ramAvailable =
    totalRam - usedRam;

  const diskAvailable =
    totalDisk - usedDisk;

  const cpuAvailable =
    totalCpu - usedCpu;

  return (
    Number(server.ram_mb) <=
      ramAvailable &&

    Number(server.disk_mb) <=
      diskAvailable &&

    Number(server.cpu_vcpu) <=
      cpuAvailable
  );
}


/*
 * Calculate resources already
 * allocated on a node.
 */

function calculateNodeUsage(
  servers,
  nodeId
) {

  const nodeServers =
    servers.filter(
      server =>
        server.node_id === nodeId
    );

  let ram = 0;
  let disk = 0;
  let cpu = 0;

  for (const server of nodeServers) {

    ram += Number(
      server.ram_mb || 0
    );

    disk += Number(
      server.disk_mb || 0
    );

    cpu += Number(
      server.cpu_vcpu || 0
    );
  }

  return {
    ram,
    disk,
    cpu
  };
}


module.exports = {
  validateLimits,
  checkNodeCapacity,
  calculateNodeUsage
};
