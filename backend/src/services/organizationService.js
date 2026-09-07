const organizationRepository = require("../repositories/organizationRepository");

async function getOrganization(organizationId) {
  const organization = await organizationRepository.findById(organizationId);

  if (!organization) {
    const error = new Error("Organization not found");
    error.statusCode = 404;
    throw error;
  }

  return organization;
}

async function updateOrganization(organizationId, data) {
  const organization = await organizationRepository.findById(organizationId);

  if (!organization) {
    const error = new Error("Organization not found");
    error.statusCode = 404;
    throw error;
  }

  return organizationRepository.updateOrganization(
    organizationId,
    data
  );
}

module.exports = {
  getOrganization,
  updateOrganization,
};
