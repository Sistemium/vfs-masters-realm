exports = function(changeEvent) {
  console.log("Function started. Change event received:", JSON.stringify(changeEvent));

  const collectionServiceItem = context.services.get("mongodb-atlas").db("Masters").collection("ServiceItem");
  const collectionServicePoint = context.services.get("mongodb-atlas").db("Masters").collection("ServicePoint");
  const collectionCustomer = context.services.get("mongodb-atlas").db("Masters").collection("Customer");

  let servicePointId;

  console.log("Analyzing changeEvent for operationType and affected collection...");
  
  if (changeEvent.operationType === "delete") {
    console.log("Detected delete operation. Collection involved:", changeEvent.ns.coll);
    if (changeEvent.ns.coll === "ServiceItem") {
      servicePointId = changeEvent.fullDocumentBeforeChange.servicePoint;
      console.log(`ServiceItem delete detected. Extracted servicePointId: ${servicePointId}`);
    } else if (changeEvent.ns.coll === "ServicePoint") {
      servicePointId = changeEvent.documentKey._id;
      console.log(`ServicePoint delete detected. Extracted documentKey._id as servicePointId: ${servicePointId}`);
    }
  } else {
    servicePointId = changeEvent.fullDocument.servicePoint || changeEvent.documentKey._id;
    console.log(`Non-delete operation. Extracted servicePointId: ${servicePointId}`);
  }

  if (!servicePointId) {
    console.log("No servicePointId identified. Exiting function.");
    return;
  }

  console.log("Proceeding with servicePointId:", servicePointId);

  return collectionServiceItem.find({ servicePoint: servicePointId }).toArray()
    .then(serviceItems => {
      console.log(`Fetched service items for servicePointId ${servicePointId}:`, JSON.stringify(serviceItems));
      const masterIds = serviceItems.map(item => item.servingMaster);
      console.log(`Mapped masterIds for update:`, JSON.stringify(masterIds));

      console.log(`Updating ServicePoint collection for servicePointId ${servicePointId} with masterIds.`);
      return collectionServicePoint.updateOne({ _id: servicePointId }, { $set: { masterIds: masterIds } })
        .then(updateResult => {
          console.log("Update result for ServicePoint:", JSON.stringify(updateResult));

          return collectionServicePoint.findOne({ _id: servicePointId })
            .then(servicePoint => {
              const customerId = servicePoint ? servicePoint.customer : null;
              console.log(`Found ServicePoint. CustomerId: ${customerId}`);

              if (customerId) {
                console.log(`Fetching ServicePoints for customerId: ${customerId}`);
                return collectionServicePoint.find({ customer: customerId }).toArray()
                  .then(servicePoints => {
                    console.log(`ServicePoints fetched for customerId ${customerId}:`, JSON.stringify(servicePoints));
                    let allMasterIds = servicePoints.reduce((acc, sp) => {
                      if (sp.masterIds) {
                        acc = acc.concat(sp.masterIds);
                      }
                      return acc;
                    }, []);

                    allMasterIds = [...new Set(allMasterIds)];
                    console.log(`Consolidated masterIds for Customer update:`, JSON.stringify(allMasterIds));

                    return collectionCustomer.updateOne({ _id: customerId }, { $set: { masterIds: allMasterIds } })
                      .then(customerUpdateResult => {
                        console.log("Update result for Customer:", JSON.stringify(customerUpdateResult));
                      });
                  });
              }
            });
        }).catch(updateError => {
          console.error("Error during update operation:", updateError);
        });
    }).catch(fetchError => {
      console.error("Error during fetch operation:", fetchError);
    });
};
