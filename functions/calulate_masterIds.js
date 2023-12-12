exports = function(changeEvent) {
  const collectionServiceItem = context.services.get("mongodb-atlas").db("Masters").collection("ServiceItem");
  const collectionServicePoint = context.services.get("mongodb-atlas").db("Masters").collection("ServicePoint");
  const collectionCustomer = context.services.get("mongodb-atlas").db("Masters").collection("Customer");

  let servicePointId;

  if (changeEvent.operationType === "delete") {
    servicePointId = changeEvent.fullDocumentBeforeChange.servicePoint;
  } else if (changeEvent.ns.coll === "ServiceItem" || changeEvent.ns.coll === "ServicePoint") {
    servicePointId = changeEvent.fullDocument.servicePoint || changeEvent.documentKey._id;
  } else {
    return;
  }

  return collectionServiceItem.find({ servicePoint: servicePointId }).toArray()
    .then(serviceItems => {
      const masterIds = serviceItems.map(item => item.servingMaster);
      collectionServicePoint.updateOne({ _id: servicePointId }, { $set: { masterIds: masterIds } });

      return collectionServicePoint.findOne({ _id: servicePointId })
        .then(servicePoint => {
          const customerId = servicePoint.customer;
          
          return collectionServicePoint.find({ customer: customerId }).toArray()
            .then(servicePoints => {
              let allMasterIds = servicePoints.reduce((acc, sp) => {
                if (sp.masterIds) {
                  acc = acc.concat(sp.masterIds);
                }
                return acc;
              }, []);

              allMasterIds = [...new Set(allMasterIds)];

              collectionCustomer.updateOne({ _id: customerId }, { $set: { masterIds: allMasterIds } });
            });
        });
    });
};
