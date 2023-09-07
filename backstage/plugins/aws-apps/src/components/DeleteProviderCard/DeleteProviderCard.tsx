import { Button, CardContent,  Grid } from "@material-ui/core";
import { InfoCard } from "@backstage/core-components";
import React, { useState } from "react";
import { useApi } from "@backstage/core-plugin-api";
import { bawsApiRef } from '../../api';
import { Alert, AlertTitle, Typography } from "@mui/material";
import { Entity } from "@backstage/catalog-model";
import { useEntity } from "@backstage/plugin-catalog-react";
import Backdrop from '@mui/material/Backdrop';
import CircularProgress from '@mui/material/CircularProgress';
import { catalogApiRef } from '@backstage/plugin-catalog-react';
import { CatalogApi } from '@backstage/plugin-catalog-react';
import { useNavigate } from 'react-router-dom';
import { sleep } from "../../helpers/util";

const DeleteProviderPanel = ({
    input: { entity, catalogApi }
  }: { input: { entity:Entity; catalogApi:CatalogApi } }) => {
    const [spinning, setSpinning] = useState(false);
    const [isDeleteSuccessful, setIsDeleteSuccessful] = useState(false);
    const [deleteResultMessage, setDeleteResultMessage] = useState("");
    const api = useApi(bawsApiRef);
    const navigate = useNavigate();
    const stackName=entity.metadata['stack-name']?.toString() || '';
    const prefix = entity.metadata['prefix']?.toString() || '';
    const accessRole = entity.metadata['environment_role']?.toString() || '';
    const awsAccount = entity.metadata['aws-account']?.toString() || '';
    const awsRegion = entity.metadata['aws-region']?.toString() || '';
    api.setBackendParams({
      appName:'',
      awsAccount:awsAccount,
      awsRegion:awsRegion,
      prefix:prefix ,
      providerName: entity.metadata.name
    });

    const handleCloseAlert = () => {
      setDeleteResultMessage("");
    };

    const [disabled, setDisabled] = useState(false);
    
    const deleteRepo= ()=> {
      const gitHost = entity.metadata.annotations ? entity.metadata.annotations['gitlab.com/instance']?.toString() : "";
      const gitRepo = entity.metadata.annotations ? entity.metadata.annotations['gitlab.com/project-slug']?.toString() : "";
      api.deleteRepository({
        gitHost, 
        gitProject:gitRepo.split('/')[0],
        gitRepoName: gitRepo.split('/')[1],
        gitAdminSecret:'aad-admin-gitlab-secrets'
      }).then(results=> {
        console.log(results);
        setDeleteResultMessage("Gitlab Repository deleted.")
        setIsDeleteSuccessful(true)
      }).catch(error=>{
        console.log(error)
        setDeleteResultMessage(`Error deleting Repository ${error}.`)
        setSpinning(false);
        setIsDeleteSuccessful(false)
      })
    }

    const deleteFromCatalog = () => {
      console.log("Deleting entity from backstage catalog")
      setDeleteResultMessage("Deleting entity from backstage catalog")
      const uid = entity.metadata["uid"]?.toString() || "";
      catalogApi.removeEntityByUid(uid)
    }

    const handleClickDelete = () => {
        if (confirm('Are you sure you want to delete this provider?')) {
            setSpinning(true);
            api.deleteProvider({stackName, accessRole}).then(async results => {
              
              console.log(results)
              setIsDeleteSuccessful(true);
              setDeleteResultMessage("Cloud Formation stack delete initiated.")
              await sleep(2000);
              // Delete the repo now.
              deleteRepo();
              await sleep(2000);
              deleteFromCatalog()
              setSpinning(false);
              await sleep(2000);
              setDeleteResultMessage("Redirect to home ....")
              navigate('/')
            }).catch(error=> {
              console.log(error)
              setSpinning(false)
              setIsDeleteSuccessful(false)
              setDeleteResultMessage(error.toString())
            })
            setDisabled(false)
          } else {
            // Do nothing!
          }
    };

    return (
        <InfoCard title="Delete Provider">
          <CardContent>
              <Grid container spacing={2}>
                <Grid item zeroMinWidth xs={8}>
                  <Typography sx={{ fontWeight: 'bold' }}>Delete this provider</Typography>
                </Grid>
                <Grid item zeroMinWidth xs={12}>
                  <Typography noWrap>
                        {/* <DeleteIcon fontSize="large" /> */}
                        <Button variant="contained" style={{backgroundColor:'red'}} onClick={handleClickDelete} disabled={disabled}>Delete</Button>
                  </Typography>
                </Grid>
                <Grid item zeroMinWidth xs={12}>
                {isDeleteSuccessful  && deleteResultMessage && (
                  <Alert id="alertGood" sx={{ mb: 2 }} severity="success" onClose={handleCloseAlert}>
                    <AlertTitle>Success</AlertTitle>
                    <strong>{entity.metadata.name}</strong> was successfully deleted!
                    {!!deleteResultMessage && (<><br /><br />{deleteResultMessage}</>)}
                  </Alert>
                  )}
                  {!isDeleteSuccessful && deleteResultMessage && (
                    <Alert  id="alertBad" sx={{ mb: 2 }} severity="error" onClose={handleCloseAlert}>
                      <AlertTitle>Error</AlertTitle>
                      Failed to delete <strong>{entity.metadata.name}</strong> promotion.
                      {!!deleteResultMessage && (<><br /><br />{deleteResultMessage}</>)}
                    </Alert>
                  )}
              </Grid>
              </Grid>
              <Backdrop
          sx={{ color: '#fff', zIndex: (theme) => theme.zIndex.drawer + 1 }}
          open={spinning}
        >
          <CircularProgress color="inherit" />
        </Backdrop>
          </CardContent>
        </InfoCard>
      );
}



export const DeleteProviderCard = () => {
  const { entity } = useEntity();
  const catalogApi = useApi(catalogApiRef);
  const input = {entity, catalogApi}
  return <DeleteProviderPanel input={input} />
};
  