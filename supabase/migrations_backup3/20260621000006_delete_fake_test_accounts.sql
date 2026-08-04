-- ============================================================================
-- DELETE FAKE / TEST ACCOUNTS
-- Date: 2026-06-21
-- Purpose: Remove 379 old fake/test accounts from auth.users and all related
--          data in user_profiles and dependent tables.
-- Uses DO $$ BEGIN ... EXCEPTION WHEN undefined_table to skip missing tables.
-- ============================================================================

-- Step 1: Create a temp table with all the user IDs to delete
CREATE TEMP TABLE _users_to_delete (user_id UUID PRIMARY KEY);

INSERT INTO _users_to_delete (user_id) VALUES
  ('1549e574-0b28-4bdc-b74b-cdb7f3e9acda'),
  ('778f6a93-338e-464d-b687-5acbc062752b'),
  ('9ffb1379-8b8b-4ee0-93d3-4ba811f0c428'),
  ('f6cfc596-8700-4e74-ba50-cd119d2a1f3f'),
  ('a1fda412-517d-42b6-89d8-691425582e8c'),
  ('129bcba5-9381-43d0-93b4-7fe1cebbe721'),
  ('a691dbc9-4a02-4307-9fa9-2a46490a5e59'),
  ('4ee5b713-40b2-46a7-94c7-f761b91e8728'),
  ('21580fe5-49be-4519-bbfe-030b2caf5379'),
  ('4c7d1c3a-6b94-43a1-bac0-a21c673679ae'),
  ('d44c3d94-6c39-458f-be3c-98fc3edf1463'),
  ('3b68d6c3-1e44-45da-a03d-a93f873037ae'),
  ('160031c2-dad0-46a1-bd33-97beb043dfa3'),
  ('b4d34780-d147-48af-a9cd-0f578ac59418'),
  ('b492b9f2-0fc3-496b-b412-d300b8c90097'),
  ('0ac93ddd-713f-4b62-b53d-342f17357823'),
  ('a1f1cb3c-a5b9-4880-b928-de3ac41d7ac6'),
  ('1ef69ac2-f2a3-400f-9257-d15740ed990c'),
  ('614e9f67-acf9-4d42-8769-6c7550983454'),
  ('0880c523-c642-42c8-ba23-95d31526d6ad'),
  ('0b1bc8f0-8271-4d49-a365-411742493dcc'),
  ('8ab53747-fb94-4a32-a52d-d583bafd1202'),
  ('ce5646ec-6d55-4aa7-beb7-6aa1bc0090b4'),
  ('12eb0fae-4924-4e67-935b-67e5191b6d27'),
  ('029ed8bc-af34-4c91-abe1-d6de17f7cfb3'),
  ('477922e5-9aa3-4990-9633-c7598d027ff4'),
  ('db595ee3-7bcb-4408-8d3a-7b899d442d81'),
  ('239e1295-0d7a-45fa-b1f1-9e0b10684899'),
  ('4b5d12eb-683f-4a8a-9b9d-cc802b896708'),
  ('c1f3eba4-ac40-412c-a3b5-6c429b52a846'),
  ('7ecaea2f-4389-4c71-bfda-3ca3ce5fbbaf'),
  ('fa73061b-51ae-4595-82d3-bb0126568987'),
  ('37c347fc-2387-4965-ab18-b3ac6bdc759c'),
  ('daf4c61f-ce17-4725-ba0c-4697cd94b8ee'),
  ('1e7ff2df-af57-4b67-9d38-8ef1fe8f1ded'),
  ('075eaaf9-ebf9-4a63-8efc-73c6cc7fd251'),
  ('1c27d576-235b-4556-a63b-e4a67aec3072'),
  ('d5e12a6d-acd7-4c18-9d75-7996616e5581'),
  ('c3cd928f-e147-41bb-bbfe-c050563f4153'),
  ('bfc61704-e722-43bb-9eb0-0d973d5aec2d'),
  ('d18b0667-9a64-479b-8978-477c5da1dacf'),
  ('5696fac6-e52e-4151-a6a9-721fc4d91592'),
  ('b985b46b-2810-40f7-8c60-0838907febe7'),
  ('91fb554d-c866-4141-a950-5bbeca7cf5ae'),
  ('033616e7-bce1-40b0-9c79-c0bca6943225'),
  ('47bc8cca-8616-4abf-8950-2ca7e67e26d7'),
  ('5b0f15aa-7bfa-4732-ab8d-b86149d536eb'),
  ('4981fac9-c2cb-413a-8d76-c324e1d52c95'),
  ('572a7aef-fcf0-4355-a01e-5950539c5921'),
  ('6d3b759f-983b-48cc-ba6c-be4b0713a93c'),
  ('762ba708-e8cf-4002-8d80-b2785d0cce20'),
  ('0b4d57a2-9298-4dbe-92ee-0799c81050fb'),
  ('10fc40fe-1212-4385-a9dc-3ed05e053421'),
  ('806f0a76-d86c-40bd-a929-4c8f94be22b0'),
  ('5ef290d8-c963-4608-be38-d20f643adcaf'),
  ('a6a171e7-7552-45a0-9544-c1064913e2d0'),
  ('5eb3f494-e6e2-482a-8df3-d15204b3003e'),
  ('17398daf-ea8f-430b-8714-db82c55a6c22'),
  ('11e52e3d-0dc5-4a7c-8a27-8f640f45679e'),
  ('dfa7865a-838b-41ef-ae23-67243ae5ffc1'),
  ('2a8c1ce2-03f9-4bb3-a387-7fab70214776'),
  ('839ffac8-c611-4713-a544-12c793d6d235'),
  ('5ec8c66c-d645-4aee-9cc7-e187b4f93c41'),
  ('2796931c-adb3-48af-ac32-537c82d06ed7'),
  ('596d4f09-23de-44ee-8acc-215a98df66be'),
  ('0c5da333-c365-4f7f-8fe8-4028f3c08020'),
  ('5f795e21-c2ff-4fb1-8863-6f93db79b06d'),
  ('5e695d38-af66-4ad0-a643-d023fabb87b3'),
  ('c09d78fb-414f-456b-82fe-da64aff25ba4'),
  ('67a3c9e1-a33f-45b0-9acc-338ddd6a34a9'),
  ('2dca8f71-acd4-4f55-a483-c9e0a86b377c'),
  ('6a7fbbbc-5b55-48ac-bb06-dd993c97a2b5'),
  ('a6b61bbb-bd30-41be-ab42-20154e014f81'),
  ('c14cada0-afea-4425-b02d-b61a83078e73'),
  ('9c60d45e-2b3a-43f1-81e8-f91aa42364b4'),
  ('e076c464-1489-4b43-9f40-21d8d0343ba2'),
  ('bc78eee9-740d-4e88-b3df-dc4bbaf54e9a'),
  ('3d337d8b-80c3-4e65-92ce-1ea02307a0a2'),
  ('49683b4f-21d0-46ab-8f36-45473836212c'),
  ('9f48da4c-91ba-460f-869f-f8935d9763a0'),
  ('f743fa78-d4f1-4b0b-869a-e083fa2233a9'),
  ('525fb78a-bc9a-4e44-b87c-659eae8dbbf9'),
  ('cdf7567f-da9e-4f80-8b87-38d423ace769'),
  ('5bacc0ab-23dd-4839-830e-f1db0800b0ab'),
  ('c5d15caa-56a3-4213-9984-2fb09efadc96'),
  ('4adc92b3-c9aa-427e-a074-59e8d06e90eb'),
  ('13c37d4a-6cd6-4fed-9fa7-9f4f5ba7bde5'),
  ('0e1a5d68-9a86-463a8f2b-5ddc6b2c4dae'),
  ('044dfa57-59d6-4aeb-a4e6-6aef08a9215d'),
  ('c9c673de-5e61-4c50-906d-0c27d5ae2400'),
  ('f615769b-037b-4d55-b503-43227b7fe36c'),
  ('03468c2b-b517-4c65-b8c6-6058676d3a1d'),
  ('4522e325-ecae-4b56-9b11-eb94b05c0253'),
  ('14c5f092-0a0e-431b-bd1e-15536266c0a9'),
  ('c1612377-ab88-42b5-bca9-843212a8c8cd'),
  ('c5de1ea0-6a02-42a2-84f0-e033b8a27019'),
  ('6c5ad4dc-e8e8-4ac8-af99-ee8643004997'),
  ('9c9cadc8-3ef3-40c3-a3c9-76b201b0bb24'),
  ('a06c27a5-2238-4117-941a-61106d61dc3e'),
  ('c1b6c85e-a965-4516-b203-fe5d40fc7145'),
  ('ca8e300c-ed60-4c22-9267-a77f0ad63a3e'),
  ('7a8c0b71-a97d-49aa-978b-71a1b6446601'),
  ('74982d57-1a48-4f6d-b153-ce5cc100adf5'),
  ('13113269-7c07-48b9-b70e-dc69fb988840'),
  ('47207597-7008-436b-9954-3b5e4c094a01'),
  ('2e48128e-53e9-42ee-a5d7-9ed47602288c'),
  ('03984088-8add-4596-94f4-69a3c0126c8d'),
  ('cf9642ff-e3e0-47bf-b6bf-3e5e494cb2ef'),
  ('a03356bf-1f14-4872-8bf6-2ad5c9762174'),
  ('81add29a-fab4-4dce-a345-48d4a52c060e'),
  ('5cc0c42c-990d-4b70-b5a7-5a04e96d812b'),
  ('8faf0309-6a79-4067-886f-b1da9f91451e'),
  ('e55762bd-cd4c-4639-8a3e-0657a256bb41'),
  ('05542a62-177a-49e6-9b12-63c958759491'),
  ('9634d1b3-b10b-4b36-8f44-d516821286fb'),
  ('3c3dc97a-9a3a-4bf8-a546-2218f55c1727'),
  ('55d38fef-2884-4089-af67-559174b5d0b6'),
  ('329fd551-aa13-4dd1-9f42-69c5363ab9ec'),
  ('d2f7251f-f22e-45f0-b89c-caf664d79533'),
  ('93113fd6-72bf-4e0b-95bd-913e64c3e079'),
  ('ebcdc041-7e83-4196-94f4-8f11554fced8'),
  ('ec2b36ff-2256-41a3-b1e5-ec04f7eed395'),
  ('f70f414f-ab5b-4444-8865-99aa7089b33b'),
  ('c6435217-3ba7-474c-a310-63856315bca5'),
  ('317e6218-9b6e-4e33-a6dd-28efae87bb03'),
  ('a6724aea-d860-4aa6-8c64-2f5422bd2aca'),
  ('ba995c5f-a5c3-4265-857e-aafcdd15796e'),
  ('b389c27c-acc1-4eea-964c-3058b49a15a8'),
  ('a1662838-f253-4ae3-b86d-dc1f2951f1f4'),
  ('d66ffaf3-1425-4c7a-a53a-205720c69aaa'),
  ('ba723e09-ea09-44f8-a4b3-ab8b83c857f0'),
  ('e4294ad7-a63c-4a48-a27f-6609f7146843'),
  ('3f7eb95e-cca1-48e6-b2e0-3bf09364d9cb'),
  ('63feb6ef-2c53-459f-ae3f-4a8a9a7dc691'),
  ('6eff3ac5-7a33-4020-aac7-97373e91e9b0'),
  ('0580120c-a4c2-4d61-98ef-ab5931a11624'),
  ('81672f4e-0aa5-4dd5-8eba-70b22e8e191f'),
  ('3a3ac02b-3ed5-41a7-a0e7-4981718c3681'),
  ('be40175c-79fc-4436-b12a-1dae77c22f72'),
  ('c699bc19-e8a4-4d2b-b258-c233b920ff5a'),
  ('e7434452-79e3-44ae-b2d5-6cf260945244'),
  ('e6b706a2-04a7-435f-a261-16353c4943db'),
  ('7ecb58cd-5ba0-4a3f-b498-017745cbe528'),
  ('f2f395c3-5131-4d4c-b505-91ce098884a6'),
  ('75d5e277-7f27-468b-bce4-35cba5a4fb16'),
  ('c63fa621-e36f-438e-9029-029eb3e7815e'),
  ('07a5bfce-da02-4664-85d4-e43ddc4339b4'),
  ('012d57b3-096e-49d8-b936-bf0a7d266c4f'),
  ('3d2502ce-6b83-4a8c-9d28-05433d961878'),
  ('fed7e26a-14ef-4b48-9a3c-6a6d18adba8d'),
  ('759cf7f8-82d8-41cc-ab84-0ba9bcc42121'),
  ('416783fc-15d7-43ff-a09d-3975f8827944'),
  ('056ff2e7-afed-4a21-ab2a-d0467da0c99a'),
  ('c9a47515-193a-43ec-abb3-3a72f06f7e3b'),
  ('062a5bc3-4294-49b9-98f3-a982646c1eb1'),
  ('a583779b-d012-4f4d-9a48-0a9b0a138dac'),
  ('60564e10-7bd5-436e-92cf-22eb05807280'),
  ('154d10a1-b79f-42d3-bff3-0e4db40df0d1'),
  ('51724468-d54a-400d-81c5-e800cb93087d'),
  ('6a185d0c-ea43-4481-9571-5d63a944a380'),
  ('adc27fbf-7e80-45c6-9d08-ea4b6d234f67'),
  ('e528a601-c81f-43eb-8d1a-e9a8d7e145f3'),
  ('e3c140a5-7a07-43ab-9e86-e70a2377fde9'),
  ('59ceb38b-24bc-4df7-81f2-fae74d828620'),
  ('817986bb-492e-4692-af71-ad654355afc6'),
  ('f73ee533-0f00-44e7-81f2-4ccc9b37e4e6'),
  ('497d672b-1866-46f6-87ba-3c9a84712556'),
  ('6a3f0ea5-5517-4c82-86ef-469bd97d3e3e'),
  ('004e1182-7c55-4066-915f-d81a176a356c'),
  ('4e94ccf7-5da2-4c48-9933-c749215c45a5'),
  ('dbba584e-da15-4127-9d93-10c21e7bfc04'),
  ('bc554a7b-5d67-45ed-838b-3fddc22507d6'),
  ('b84b2fd3-4f51-4cb7-a2f8-0a9497c34729'),
  ('51244fb3-3e6d-4a68-a270-7749186d16c0'),
  ('477ecd81-2deb-4743-aa6b-1321362a56cb'),
  ('3f2521db-e0eb-4a6b-9e5b-db4d8f4e5cb3'),
  ('d6756484-834f-458a-bb05-d4de8ab39d08'),
  ('2955c0e4-9e48-49fe-a7fb-790f2b745b90'),
  ('b29c59c5-99f6-42f3-a4b8-675654d353a2'),
  ('a9467a8c-6bd3-4a19-ba8c-29ce5479ad1a'),
  ('a4925c0f-9a20-4910-8693-4e786bf0be67'),
  ('2996a782-6f0e-448d-af9f-e05565c4450f'),
  ('4aadce69-5483-488f-9bb7-76db9c717ef8'),
  ('492128ce-ca7d-4295-b80c-1a1492382669'),
  ('2d7df34c-984b-4601-b61f-7f52a327733d'),
  ('366d7c09-c658-4e4f-8a8f-4713379ea8ef'),
  ('7715916f-c2d4-4736-b39b-fb6dadc57dd1'),
  ('7169a016-1a07-4589-9bde-88fe8ecc5192'),
  ('2fb16de3-475e-43c7-967e-f2d436b0db3b'),
  ('4a5ad76a-e14b-45a6-aba4-b569f3ead2b5'),
  ('da42203d-f52a-498e-8bb4-25d2a20e830d'),
  ('9d79d940-b093-4d58-b8a3-a1e98066705f'),
  ('aab07dfc-3304-4553-a1db-fa410f264ead'),
  ('10cd066b-fabc-4413-a803-a6083002d3d6'),
  ('ccf71d16-5f90-4614-bd53-189003c6bb19'),
  ('9448d279-09fb-4b17-a26c-3e1919954866'),
  ('30f2c7f7-38b2-4d84-b4c1-56f421ab2c08'),
  ('8ae149c1-23c0-461e-a2f4-5a1982ce5b1d'),
  ('f1ac2843-65dd-4d87-ae79-ee4d13b89045'),
  ('0e9385e6-d30d-4b86-a8ef-fd2df0899821'),
  ('51032926-2514-4ac6-8202-b120b6af9727'),
  ('068e8b6d-9c64-47e8-8e44-2cb32f7d0e70'),
  ('cf0dd520-a0bd-4386-b66f-129ead7d4892'),
  ('f7b6b3f4-4d07-4cad-922e-b470e7a94104'),
  ('7eb5b541-515c-428f-ba4e-37184b6b93ed'),
  ('c4194a3d-432e-4a7a-945f-c15ed2197950'),
  ('05e27067-2e13-4a92-a93c-bdfd0e768e7f'),
  ('61c7b5ba-828d-47d3-8187-61b438cb4518'),
  ('c2c9a86f-0267-4114-905a-e66375f095f4'),
  ('0428e76a-2392-4a8a-8ee7-486c419de289'),
  ('757d5da0-fe02-46cc-a479-788317bdd35e'),
  ('0ab94700-bd2d-46a6-8f4e-8202bc63036f'),
  ('7292e888-83ea-4891-a4ec-3a57aefb1beb'),
  ('9065b0b6-5a4e-411c-a1a5-373a8252fdd9'),
  ('ec6f55d5-6481-4d19-9937-703a8938e7a7'),
  ('5b18b108-edf1-4329-80e6-fb70085d85cb'),
  ('cb18298a-a465-44be-94b9-45ebb7b11877'),
  ('0fb30253-929c-4092-8537-934513a5a27c'),
  ('0a8f9661-3379-43e2-be7c-91cd916c2249'),
  ('f33a3a20-2a15-43b7-8229-de1e72288e29'),
  ('24b8f569-0e8f-4804-bffd-a239cc8a2fb4'),
  ('a67d1736-0205-4436-8089-c4d0912fb5fa'),
  ('b9e0a3dc-2ac4-494d-9fc8-6f3d44a22e8e'),
  ('0d9a9f02-6e9d-4618-8566-9782d98d93d8'),
  ('9dc5ecb4-a0f8-483c-95eb-ea864d56f4d7'),
  ('96f553b5-d349-4d13-baa1-78aea84506ea'),
  ('455c4d7b-03e4-44ed-9f88-63f6c2715bd8'),
  ('3f914509-1e58-434e-8a6e-a8fd3cceba70'),
  ('1177ed92-f0f9-48b9-aaf0-729ed529cb77'),
  ('2042b4fd-b28e-4653-914c-a9237a381a0d'),
  ('09e9ade2-5832-408a-8d0d-ff01ff948e44'),
  ('14fa1824-c29a-4774-82e2-73f1643a9763'),
  ('a7af4a68-0485-4827-ba2d-8be8b907be9a'),
  ('168b2564-43aa-408c-9d99-46c0feff0e8b'),
  ('13af9ca8-0bd3-481e-921f-ed8edd47b981'),
  ('152165c2-0d90-48f8-b7ad-f306173e5715'),
  ('ebc12c4e-2af3-4df6-864c-77e24088ddc9'),
  ('e179fee5-53e7-4e5b-a1c6-cdfc8f78ecb2'),
  ('f1949f4a-5539-4bdb-ac8c-f473545a6815'),
  ('526fdc5d-d173-4ca6-9114-a0c41b0a9aa2'),
  ('7e5cf390-509b-411d-8614-0e46b4dae7a2'),
  ('97220baf-b7d5-43b8-99f4-9d201b9fba89'),
  ('652906fb-fda5-436f-80c9-75190b553a43'),
  ('a302be70-0d5e-415d-87f1-0e53ad119615'),
  ('84dcc769-c681-43f0-a205-bed051927b4c'),
  ('39b7e35b-436c-4189-b2af-e8f97c006ccf'),
  ('4f77ad6b-1157-4b86-adae-e7c9616d1b9f'),
  ('d5713ac7-67e4-444b-b3ed-ad7658c94626'),
  ('152b4660-f642-4fbe-9a67-0a82019eb887'),
  ('7877d504-1c90-4a64-a6f3-f5c6ffccd9ec'),
  ('b3419d1f-d1cb-474c-be99-eddb8399df5f'),
  ('3579bd3b-98b8-48d4-8284-12f8c0533cf1'),
  ('38f35646-e1ab-4183-8750-90479aa308ba'),
  ('2d165faf-aaa3-4daf-975e-dd31d4972fc2'),
  ('6d9dc34d-30db-441c-a4ef-40c334c0438c'),
  ('00ef42e8-7bc3-4cbd-8452-3c63cede71d2'),
  ('04e8840d-1be7-46db-821d-e17fa219cd3c'),
  ('fa97c045-592d-4640-80dc-6fb2b532c7fe'),
  ('ea60d9b1-f10b-4bdb-b993-937333aaedbf'),
  ('d9653f97-fc70-4fc4-9304-96015b304b37'),
  ('7b3bd4b5-e3e3-4e79-afbe-81a6fc07706b'),
  ('6da0eec5-034d-4448-9ca3-7de341a8b7b6'),
  ('fef14840-bda1-48ee-a988-e112005410b3'),
  ('d72d0d90-c2c2-4d99-b0e1-636a0c495681'),
  ('7879ba26-303e-4bf3-9639-83079b5d6768'),
  ('129a47f7-3415-4c2e-8190-e44d9657c06d'),
  ('02874fd8-fba6-4da9-8b8a-00efaa571598'),
  ('47b47a49-60d6-42de-9768-7bbb1b0f18b2'),
  ('2277fdf5-0021-402a-b6fe-790c27225a75'),
  ('84284453-70e5-41dd-9649-6a5f0863a211'),
  ('7f4c29aa-ac5a-42dc-b8c9-e857d3ef85e3'),
  ('c5c97556-adfe-4d7a-a00e-70983adbb907'),
  ('0a794ed7-980e-41e6-a365-bc7a8b5c7649'),
  ('52f5cda7-957e-4a83-8b68-097e60a3027b'),
  ('5b38795e-ac81-434c-b6b3-5ba678e76844'),
  ('d3f5c2e0-0c9e-4944-b566-5051e6c82b40'),
  ('3dced269-b580-405f-ba8f-7876504c09f5'),
  ('7934a370-a07e-4e29-ba00-4366f59d2902'),
  ('9592b14a-149d-4e5c-bdd3-f13d3105bffa'),
  ('44cf10cc-0593-469b-ba31-9ba8d888e602'),
  ('1e0b96b8-6a2a-4ead-b7b3-1a56c93420d4'),
  ('0130df74-f991-4fd0-8dd6-92ea54ca8e9f'),
  ('2327518f-730c-438f-929d-18916421325b'),
  ('292c4640-29fd-4f30-be74-2b98d09764c3'),
  ('3a047c1d-3b4b-48e7-b5e5-b5af000d09c3'),
  ('895fc44e-1b00-42f1-bbab-50641d87b8c1'),
  ('d1821e9d-6307-48ea-b28f-b9f25239a4f5'),
  ('b735fb2b-9b8b-4eda-87a4-06306d2c7db1'),
  ('5265e76b-c6ff-4cad-90bb-326affff45d1'),
  ('1ef3c7cc-daf5-40b6-9708-8453699b9e14'),
  ('be77b391-e7eb-46cb-bc74-0bef91445a64'),
  ('48153bfa-2ff0-43b7-90ff-9abaf546318a'),
  ('142d77b0-020d-4dfe-b287-d51e64d7cfc0'),
  ('90b2b6d4-6199-47ee-8ebf-a64983025a65'),
  ('b8be5d21-f452-4898-b2d2-0e3d7f07e1cf'),
  ('f09b777d-6929-44a7-8750-18c68b477790'),
  ('1280ab3c-a70c-4c9b-8123-4cb40fb2e10e'),
  ('7eff6269-72d9-4fe6-b985-35f2059eed79'),
  ('08dd875e-45ab-4389-9881-3de5935e20c3'),
  ('29c2e7aa-d8b1-4223-be9d-092be702b0bf'),
  ('7abb161d-b0cb-4865-b1c5-a3274e103de6'),
  ('f3a55fb5-e4ac-43ab-9fc2-22af2ecab304'),
  ('e21c5bca-e62e-430c-aa30-a0f078c86b41'),
  ('a1911dfb-c68c-43b3-9577-c949d0af852a'),
  ('1cfcde50-34ad-42e0-997e-5d6f2024979e'),
  ('e8f15410-c093-4f1c-bdc3-8c328b574511'),
  ('fa8119df-9369-4f1a-948c-0bd4fd73f8e5'),
  ('bece3157-725b-45c9-b1f4-e4e95f156ab1'),
  ('055a4030-8506-4f6e-beb8-ed4a0cc2349e'),
  ('5f73723c-a5b1-4c45-933e-3ab87c5d683b'),
  ('e098247c-b705-4a75-b686-7f539f5eb4d3'),
  ('cf073ffa-351b-48cf-bf77-7e61026ab077'),
  ('b89199d2-3fa1-43c9-b7be-33bdf716323e'),
  ('e1bbce6b-0db2-4dbc-9e7d-07356ae6cfc6'),
  ('0e7dd2ce-63dc-42d0-a59d-7df1608341a2'),
  ('a53ae950-e7fd-45ea-9616-6b8e316df663'),
  ('fdcd7ff0-be10-4e4b-8113-3ffbea71e7a5'),
  ('d44fd9bc-7aa6-4845-9a70-24c21e147842'),
  ('1ab399c9-3f88-4183-af0f-2c806c29542e'),
  ('055817a5-795b-4954-a97c-f28cc04e92be'),
  ('47dd7f1e-38e2-4b8c-bbef-6f1e75d9a2cf'),
  ('146415e2-32ae-42cc-881b-85adb486153a'),
  ('c04f4368-3e5b-4ef5-b584-59262bed3053'),
  ('0988d044-7c63-4e4b-9f88-f3770047cb63'),
  ('0ad5a158-7bdf-4eac-b273-8acc078e84d3'),
  ('06ea6319-7790-4842-9469-5e6b2cd9e238'),
  ('0977d9ae-6f65-4a6e-9193-0afff0a316dc'),
  ('0c6538e7-a9d5-43f4-8776-f74d880ff627'),
  ('01211201-6d97-43fa-9c72-e5932ee034f7'),
  ('00942e6e-7e0c-40b2-aafb-40ceaefb1708'),
  ('05ff976f-a815-4cf2-adbc-e5379dbcf062'),
  ('0701ea97-ba32-4e73-8cf6-ec686f3b0d3e'),
  ('0c3067e3-2342-40a1-8181-7b331f6e76ae'),
  ('038879f4-1d87-47d0-82cb-bd58d07bf3d4'),
  ('03cd7330-1f94-4208-8eb2-fe13f9deebe0'),
  ('071c8ee8-2514-4903-9597-518057b2cf87'),
  ('0f31e1c8-7eb4-4171-82ae-779030710c66'),
  ('156f8ebe-6220-4cd7-9638-6fbdb8b3e2fa'),
  ('0136b3fb-3965-4644-bf5b-561fcc96ae0f'),
  ('00757e47-d150-44e1-a91b-4106e97f33bd'),
  ('13f78124-5c44-4599-89f5-9c96b3ec6201'),
  ('0a0ec6af-130f-4905-a31a-a1d6a1840aa1'),
  ('0a1f320c-bc42-4499-9b27-d9c14f5f2594'),
  ('06134b0f-07ea-4656-9997-e0a49c25ad1e'),
  ('141784f1-983e-40c4-b182-95f5c54f24b9'),
  ('04758298-174c-4ce2-862b-1ffd3f6aa9ff'),
  ('0bb0093b-cb93-478c-b09f-c3cfaf958ec2'),
  ('07d4be4e-6024-4b7d-8f47-2a6c7018c384'),
  ('11bdd6a7-fc40-48c7-9237-9fd421ddaaa2'),
  ('044ea420-8123-47f4-a5a2-a8302d8f165f'),
  ('035f7acc-76df-4aa8-bf52-2f13fb68f30a'),
  ('0cf0dffb-673a-4f06-a7de-7f5f770dc3f1'),
  ('108e6c0d-c0f0-4c69-87cd-8a9ba8961a1b'),
  ('0df78840-4929-41fc-bbc1-2df42f34d070'),
  ('0eff2351-29e3-43d8-9ab1-715a87668127'),
  ('15d4a441-21a5-4bff-9a06-171f0455de51'),
  ('0fdd9cd3-4088-45a4-a876-3cfa097a4f6a'),
  ('06e8c724-527b-445e-8313-c02c99a566db'),
  ('0a96a827-2456-4d09-a32d-ea1f5f0bcf2e'),
  ('0a9d91fa-00d4-4940-9e95-458422a60d7c'),
  ('02d929f1-5e11-4f71-8163-6d1def0c03be'),
  ('11effc70-11cc-4b46-8d63-493adaf4ee00'),
  ('09349642-c374-4b79-a9d3-55c6974726ac'),
  ('0e1a6a63-b990-4aa2-bf49-5e851bbb3a8f'),
  ('0f4b173f-b346-4238-9134-239b9a8a0170'),
  ('038b3875-e10a-451d-ae08-3439607bea00'),
  ('09331511-3643-46f6-94a6-2b9dc74396c2'),
  ('049b059a-8a62-4e67-a950-d703bd5cec75'),
  ('07097adc-7a80-4b2d-a5fb-38cc464e9967'),
  ('10a6d7fc-4dae-41a9-b9d9-6225244b592d'),
  ('133072a7-f9b1-497f-80a5-684f63a5cb2e'),
  ('113972e1-7f6d-402e-ac61-de4f25c2e3b0'),
  ('15124590-1597-44ac-bb87-0669d9da9857'),
  ('04e2ff47-0e47-466e-a665-3ed1591ddb76'),
  ('0ff41766-81a9-4148-a21c-ee55578f0cf6'),
  ('14c3c997-13e3-4c15-b4a9-7695a0281fde'),
  ('12c7186f-1bcd-4016-b15d-f06a3b0925c4'),
  ('15e52dbc-157c-4e9d-9979-d4b3b91b04b4'),
  ('1413a680-9dad-4aeb-9dd2-6103f92474aa');

-- Step 2: Delete from all child tables using IF EXISTS pattern
-- Each table is wrapped in a DO block that catches "undefined_table" exceptions
-- so it skips tables that don't exist in your database.

DO $$
BEGIN
  -- Core user data tables
  BEGIN DELETE FROM public.user_stats WHERE user_id IN (SELECT user_id FROM _users_to_delete); EXCEPTION WHEN undefined_table THEN RAISE NOTICE 'Skipping: user_stats'; END;
  BEGIN DELETE FROM public.user_credit WHERE user_id IN (SELECT user_id FROM _users_to_delete); EXCEPTION WHEN undefined_table THEN RAISE NOTICE 'Skipping: user_credit'; END;
  BEGIN DELETE FROM public.user_perks WHERE user_id IN (SELECT user_id FROM _users_to_delete); EXCEPTION WHEN undefined_table THEN RAISE NOTICE 'Skipping: user_perks'; END;
  BEGIN DELETE FROM public.user_subscriptions WHERE subscriber_id IN (SELECT user_id FROM _users_to_delete) OR broadcaster_id IN (SELECT user_id FROM _users_to_delete); EXCEPTION WHEN undefined_table THEN RAISE NOTICE 'Skipping: user_subscriptions'; END;
  BEGIN DELETE FROM public.user_reports WHERE reporter_id IN (SELECT user_id FROM _users_to_delete) OR reported_user_id IN (SELECT user_id FROM _users_to_delete); EXCEPTION WHEN undefined_table THEN RAISE NOTICE 'Skipping: user_reports'; END;
  BEGIN DELETE FROM public.user_settings WHERE user_id IN (SELECT user_id FROM _users_to_delete); EXCEPTION WHEN undefined_table THEN RAISE NOTICE 'Skipping: user_settings'; END;
  BEGIN DELETE FROM public.user_inventory WHERE user_id IN (SELECT user_id FROM _users_to_delete); EXCEPTION WHEN undefined_table THEN RAISE NOTICE 'Skipping: user_inventory'; END;
  BEGIN DELETE FROM public.user_cars WHERE user_id IN (SELECT user_id FROM _users_to_delete); EXCEPTION WHEN undefined_table THEN RAISE NOTICE 'Skipping: user_cars'; END;
  BEGIN DELETE FROM public.user_cars WHERE user_id IN (SELECT user_id FROM _users_to_delete); EXCEPTION WHEN undefined_table THEN RAISE NOTICE 'Skipping: user_cars (owner_id)'; END;
  BEGIN DELETE FROM public.properties WHERE owner_id IN (SELECT user_id FROM _users_to_delete); EXCEPTION WHEN undefined_table THEN RAISE NOTICE 'Skipping: properties (owner_id)'; END;
  BEGIN DELETE FROM public.marketplace_orders WHERE buyer_id IN (SELECT user_id FROM _users_to_delete) OR seller_id IN (SELECT user_id FROM _users_to_delete); EXCEPTION WHEN undefined_table THEN RAISE NOTICE 'Skipping: marketplace_orders'; END;
  BEGIN DELETE FROM public.marketplace_listings WHERE seller_id IN (SELECT user_id FROM _users_to_delete); EXCEPTION WHEN undefined_table THEN RAISE NOTICE 'Skipping: marketplace_listings'; END;
  BEGIN DELETE FROM public.coin_transactions WHERE user_id IN (SELECT user_id FROM _users_to_delete); EXCEPTION WHEN undefined_table THEN RAISE NOTICE 'Skipping: coin_transactions'; END;
  BEGIN DELETE FROM public.notifications WHERE user_id IN (SELECT user_id FROM _users_to_delete); EXCEPTION WHEN undefined_table THEN RAISE NOTICE 'Skipping: notifications'; END;
  BEGIN DELETE FROM public.jail_notifications WHERE user_id IN (SELECT user_id FROM _users_to_delete); EXCEPTION WHEN undefined_table THEN RAISE NOTICE 'Skipping: jail_notifications'; END;
  BEGIN DELETE FROM public.conversation_members WHERE user_id IN (SELECT user_id FROM _users_to_delete); EXCEPTION WHEN undefined_table THEN RAISE NOTICE 'Skipping: conversation_members'; END;
  BEGIN DELETE FROM public.conversation_messages WHERE sender_id IN (SELECT user_id FROM _users_to_delete); EXCEPTION WHEN undefined_table THEN RAISE NOTICE 'Skipping: conversation_messages'; END;
  BEGIN DELETE FROM public.stream_gifts WHERE sender_id IN (SELECT user_id FROM _users_to_delete) OR receiver_id IN (SELECT user_id FROM _users_to_delete); EXCEPTION WHEN undefined_table THEN RAISE NOTICE 'Skipping: stream_gifts'; END;
  BEGIN DELETE FROM public.stream_messages WHERE user_id IN (SELECT user_id FROM _users_to_delete); EXCEPTION WHEN undefined_table THEN RAISE NOTICE 'Skipping: stream_messages'; END;
  BEGIN DELETE FROM public.stream_viewers WHERE user_id IN (SELECT user_id FROM _users_to_delete); EXCEPTION WHEN undefined_table THEN RAISE NOTICE 'Skipping: stream_viewers'; END;
  BEGIN DELETE FROM public.stream_audience_presence WHERE user_id IN (SELECT user_id FROM _users_to_delete); EXCEPTION WHEN undefined_table THEN RAISE NOTICE 'Skipping: stream_audience_presence'; END;
  BEGIN DELETE FROM public.stream_seat_sessions WHERE user_id IN (SELECT user_id FROM _users_to_delete); EXCEPTION WHEN undefined_table THEN RAISE NOTICE 'Skipping: stream_seat_sessions'; END;
  BEGIN DELETE FROM public.stream_bans WHERE user_id IN (SELECT user_id FROM _users_to_delete) OR banned_by IN (SELECT user_id FROM _users_to_delete); EXCEPTION WHEN undefined_table THEN RAISE NOTICE 'Skipping: stream_bans'; END;
  BEGIN DELETE FROM public.streams WHERE broadcaster_id IN (SELECT user_id FROM _users_to_delete); EXCEPTION WHEN undefined_table THEN RAISE NOTICE 'Skipping: streams'; END;
  BEGIN DELETE FROM public.battle_participants WHERE user_id IN (SELECT user_id FROM _users_to_delete); EXCEPTION WHEN undefined_table THEN RAISE NOTICE 'Skipping: battle_participants'; END;
  BEGIN DELETE FROM public.battles WHERE challenger_id IN (SELECT user_id FROM _users_to_delete) OR opponent_id IN (SELECT user_id FROM _users_to_delete); EXCEPTION WHEN undefined_table THEN RAISE NOTICE 'Skipping: battles'; END;
  BEGIN DELETE FROM public.family_members WHERE user_id IN (SELECT user_id FROM _users_to_delete); EXCEPTION WHEN undefined_table THEN RAISE NOTICE 'Skipping: family_members'; END;
  BEGIN DELETE FROM public.troll_wall_posts WHERE user_id IN (SELECT user_id FROM _users_to_delete); EXCEPTION WHEN undefined_table THEN RAISE NOTICE 'Skipping: troll_wall_posts'; END;
  BEGIN DELETE FROM public.payout_requests WHERE user_id IN (SELECT user_id FROM _users_to_delete); EXCEPTION WHEN undefined_table THEN RAISE NOTICE 'Skipping: payout_requests'; END;
  BEGIN DELETE FROM public.paypal_transactions WHERE user_id IN (SELECT user_id FROM _users_to_delete); EXCEPTION WHEN undefined_table THEN RAISE NOTICE 'Skipping: paypal_transactions'; END;
  BEGIN DELETE FROM public.active_sessions WHERE user_id IN (SELECT user_id FROM _users_to_delete); EXCEPTION WHEN undefined_table THEN RAISE NOTICE 'Skipping: active_sessions'; END;
  BEGIN DELETE FROM public.anonymous_chat_slots WHERE user_id IN (SELECT user_id FROM _users_to_delete); EXCEPTION WHEN undefined_table THEN RAISE NOTICE 'Skipping: anonymous_chat_slots'; END;
  BEGIN DELETE FROM public.auction_bids WHERE bidder_id IN (SELECT user_id FROM _users_to_delete); EXCEPTION WHEN undefined_table THEN RAISE NOTICE 'Skipping: auction_bids'; END;
  BEGIN DELETE FROM public.auction_shows WHERE auctioneer_id IN (SELECT user_id FROM _users_to_delete); EXCEPTION WHEN undefined_table THEN RAISE NOTICE 'Skipping: auction_shows'; END;
  BEGIN DELETE FROM public.agency_members WHERE user_id IN (SELECT user_id FROM _users_to_delete); EXCEPTION WHEN undefined_table THEN RAISE NOTICE 'Skipping: agency_members'; END;
  BEGIN DELETE FROM public.agency_applications WHERE user_id IN (SELECT user_id FROM _users_to_delete); EXCEPTION WHEN undefined_table THEN RAISE NOTICE 'Skipping: agency_applications'; END;
  BEGIN DELETE FROM public.court_cases WHERE plaintiff_id IN (SELECT user_id FROM _users_to_delete) OR defendant_id IN (SELECT user_id FROM _users_to_delete) OR judge_id IN (SELECT user_id FROM _users_to_delete); EXCEPTION WHEN undefined_table THEN RAISE NOTICE 'Skipping: court_cases'; END;
  BEGIN DELETE FROM public.court_dockets WHERE created_by IN (SELECT user_id FROM _users_to_delete); EXCEPTION WHEN undefined_table THEN RAISE NOTICE 'Skipping: court_dockets'; END;
  BEGIN DELETE FROM public.officer_reports WHERE officer_id IN (SELECT user_id FROM _users_to_delete) OR reported_user_id IN (SELECT user_id FROM _users_to_delete); EXCEPTION WHEN undefined_table THEN RAISE NOTICE 'Skipping: officer_reports'; END;
  BEGIN DELETE FROM public.votes WHERE voter_id IN (SELECT user_id FROM _users_to_delete) OR candidate_id IN (SELECT user_id FROM _users_to_delete); EXCEPTION WHEN undefined_table THEN RAISE NOTICE 'Skipping: votes'; END;
  BEGIN DELETE FROM public.election_candidates WHERE user_id IN (SELECT user_id FROM _users_to_delete); EXCEPTION WHEN undefined_table THEN RAISE NOTICE 'Skipping: election_candidates'; END;
  BEGIN DELETE FROM public.proposals WHERE proposed_by IN (SELECT user_id FROM _users_to_delete); EXCEPTION WHEN undefined_table THEN RAISE NOTICE 'Skipping: proposals'; END;
  BEGIN DELETE FROM public.treasury_transactions WHERE user_id IN (SELECT user_id FROM _users_to_delete); EXCEPTION WHEN undefined_table THEN RAISE NOTICE 'Skipping: treasury_transactions'; END;
  BEGIN DELETE FROM public.insurance_policies WHERE user_id IN (SELECT user_id FROM _users_to_delete); EXCEPTION WHEN undefined_table THEN RAISE NOTICE 'Skipping: insurance_policies'; END;
  BEGIN DELETE FROM public.insurance_claims WHERE user_id IN (SELECT user_id FROM _users_to_delete); EXCEPTION WHEN undefined_table THEN RAISE NOTICE 'Skipping: insurance_claims'; END;
  BEGIN DELETE FROM public.neighborhood_members WHERE user_id IN (SELECT user_id FROM _users_to_delete); EXCEPTION WHEN undefined_table THEN RAISE NOTICE 'Skipping: neighborhood_members'; END;
  BEGIN DELETE FROM public.neighborhood_events WHERE created_by IN (SELECT user_id FROM _users_to_delete); EXCEPTION WHEN undefined_table THEN RAISE NOTICE 'Skipping: neighborhood_events'; END;
  BEGIN DELETE FROM public.utromail_messages WHERE sender_id IN (SELECT user_id FROM _users_to_delete) OR recipient_id IN (SELECT user_id FROM _users_to_delete); EXCEPTION WHEN undefined_table THEN RAISE NOTICE 'Skipping: utromail_messages'; END;
  BEGIN DELETE FROM public.quiz_attempts WHERE user_id IN (SELECT user_id FROM _users_to_delete); EXCEPTION WHEN undefined_table THEN RAISE NOTICE 'Skipping: quiz_attempts'; END;
  BEGIN DELETE FROM public.attendance_records WHERE user_id IN (SELECT user_id FROM _users_to_delete); EXCEPTION WHEN undefined_table THEN RAISE NOTICE 'Skipping: attendance_records'; END;
  BEGIN DELETE FROM public.loan_applications WHERE user_id IN (SELECT user_id FROM _users_to_delete); EXCEPTION WHEN undefined_table THEN RAISE NOTICE 'Skipping: loan_applications'; END;
  BEGIN DELETE FROM public.loan_payments WHERE user_id IN (SELECT user_id FROM _users_to_delete); EXCEPTION WHEN undefined_table THEN RAISE NOTICE 'Skipping: loan_payments'; END;
  BEGIN DELETE FROM public.staff_meetings WHERE created_by IN (SELECT user_id FROM _users_to_delete); EXCEPTION WHEN undefined_table THEN RAISE NOTICE 'Skipping: staff_meetings'; END;
  BEGIN DELETE FROM public.staff_meeting_attendees WHERE user_id IN (SELECT user_id FROM _users_to_delete); EXCEPTION WHEN undefined_table THEN RAISE NOTICE 'Skipping: staff_meeting_attendees'; END;
  BEGIN DELETE FROM public.survey_responses WHERE user_id IN (SELECT user_id FROM _users_to_delete); EXCEPTION WHEN undefined_table THEN RAISE NOTICE 'Skipping: survey_responses'; END;
  BEGIN DELETE FROM public.weekly_challenge_entries WHERE user_id IN (SELECT user_id FROM _users_to_delete); EXCEPTION WHEN undefined_table THEN RAISE NOTICE 'Skipping: weekly_challenge_entries'; END;
  BEGIN DELETE FROM public.shareathon_entries WHERE user_id IN (SELECT user_id FROM _users_to_delete); EXCEPTION WHEN undefined_table THEN RAISE NOTICE 'Skipping: shareathon_entries'; END;
  BEGIN DELETE FROM public.gift_inventory WHERE user_id IN (SELECT user_id FROM _users_to_delete); EXCEPTION WHEN undefined_table THEN RAISE NOTICE 'Skipping: gift_inventory'; END;
  BEGIN DELETE FROM public.equipped_items WHERE user_id IN (SELECT user_id FROM _users_to_delete); EXCEPTION WHEN undefined_table THEN RAISE NOTICE 'Skipping: equipped_items'; END;
  BEGIN DELETE FROM public.blocked_users WHERE blocker_id IN (SELECT user_id FROM _users_to_delete) OR blocked_id IN (SELECT user_id FROM _users_to_delete); EXCEPTION WHEN undefined_table THEN RAISE NOTICE 'Skipping: blocked_users'; END;
  BEGIN DELETE FROM public.follows WHERE follower_id IN (SELECT user_id FROM _users_to_delete) OR following_id IN (SELECT user_id FROM _users_to_delete); EXCEPTION WHEN undefined_table THEN RAISE NOTICE 'Skipping: follows'; END;
  BEGIN DELETE FROM public.likes WHERE user_id IN (SELECT user_id FROM _users_to_delete); EXCEPTION WHEN undefined_table THEN RAISE NOTICE 'Skipping: likes'; END;
  BEGIN DELETE FROM public.comments WHERE user_id IN (SELECT user_id FROM _users_to_delete); EXCEPTION WHEN undefined_table THEN RAISE NOTICE 'Skipping: comments'; END;
  BEGIN DELETE FROM public.reels WHERE user_id IN (SELECT user_id FROM _users_to_delete); EXCEPTION WHEN undefined_table THEN RAISE NOTICE 'Skipping: reels'; END;
  BEGIN DELETE FROM public.reel_comments WHERE user_id IN (SELECT user_id FROM _users_to_delete); EXCEPTION WHEN undefined_table THEN RAISE NOTICE 'Skipping: reel_comments'; END;
  BEGIN DELETE FROM public.reel_likes WHERE user_id IN (SELECT user_id FROM _users_to_delete); EXCEPTION WHEN undefined_table THEN RAISE NOTICE 'Skipping: reel_likes'; END;
  BEGIN DELETE FROM public.stories WHERE user_id IN (SELECT user_id FROM _users_to_delete); EXCEPTION WHEN undefined_table THEN RAISE NOTICE 'Skipping: stories'; END;
  BEGIN DELETE FROM public.bookmarks WHERE user_id IN (SELECT user_id FROM _users_to_delete); EXCEPTION WHEN undefined_table THEN RAISE NOTICE 'Skipping: bookmarks'; END;
  BEGIN DELETE FROM public.saved_items WHERE user_id IN (SELECT user_id FROM _users_to_delete); EXCEPTION WHEN undefined_table THEN RAISE NOTICE 'Skipping: saved_items'; END;
  BEGIN DELETE FROM public.search_history WHERE user_id IN (SELECT user_id FROM _users_to_delete); EXCEPTION WHEN undefined_table THEN RAISE NOTICE 'Skipping: search_history'; END;
  BEGIN DELETE FROM public.activity_log WHERE user_id IN (SELECT user_id FROM _users_to_delete); EXCEPTION WHEN undefined_table THEN RAISE NOTICE 'Skipping: activity_log'; END;
  BEGIN DELETE FROM public.login_history WHERE user_id IN (SELECT user_id FROM _users_to_delete); EXCEPTION WHEN undefined_table THEN RAISE NOTICE 'Skipping: login_history'; END;
  BEGIN DELETE FROM public.security_events WHERE user_id IN (SELECT user_id FROM _users_to_delete); EXCEPTION WHEN undefined_table THEN RAISE NOTICE 'Skipping: security_events'; END;
  BEGIN DELETE FROM public.admin_actions WHERE admin_id IN (SELECT user_id FROM _users_to_delete) OR target_user_id IN (SELECT user_id FROM _users_to_delete); EXCEPTION WHEN undefined_table THEN RAISE NOTICE 'Skipping: admin_actions'; END;
  BEGIN DELETE FROM public.bug_reports WHERE reporter_id IN (SELECT user_id FROM _users_to_delete); EXCEPTION WHEN undefined_table THEN RAISE NOTICE 'Skipping: bug_reports'; END;
  BEGIN DELETE FROM public.feedback WHERE user_id IN (SELECT user_id FROM _users_to_delete); EXCEPTION WHEN undefined_table THEN RAISE NOTICE 'Skipping: feedback'; END;
  BEGIN DELETE FROM public.ratings WHERE rater_id IN (SELECT user_id FROM _users_to_delete) OR ratee_id IN (SELECT user_id FROM _users_to_delete); EXCEPTION WHEN undefined_table THEN RAISE NOTICE 'Skipping: ratings'; END;
  BEGIN DELETE FROM public.transactions WHERE user_id IN (SELECT user_id FROM _users_to_delete); EXCEPTION WHEN undefined_table THEN RAISE NOTICE 'Skipping: transactions'; END;
  BEGIN DELETE FROM public.wallet_transactions WHERE user_id IN (SELECT user_id FROM _users_to_delete); EXCEPTION WHEN undefined_table THEN RAISE NOTICE 'Skipping: wallet_transactions'; END;
  BEGIN DELETE FROM public.rewards_claimed WHERE user_id IN (SELECT user_id FROM _users_to_delete); EXCEPTION WHEN undefined_table THEN RAISE NOTICE 'Skipping: rewards_claimed'; END;
  BEGIN DELETE FROM public.daily_rewards WHERE user_id IN (SELECT user_id FROM _users_to_delete); EXCEPTION WHEN undefined_table THEN RAISE NOTICE 'Skipping: daily_rewards'; END;
  BEGIN DELETE FROM public.achievements WHERE user_id IN (SELECT user_id FROM _users_to_delete); EXCEPTION WHEN undefined_table THEN RAISE NOTICE 'Skipping: achievements'; END;
  BEGIN DELETE FROM public.user_achievements WHERE user_id IN (SELECT user_id FROM _users_to_delete); EXCEPTION WHEN undefined_table THEN RAISE NOTICE 'Skipping: user_achievements'; END;
  BEGIN DELETE FROM public.mission_progress WHERE user_id IN (SELECT user_id FROM _users_to_delete); EXCEPTION WHEN undefined_table THEN RAISE NOTICE 'Skipping: mission_progress'; END;
  BEGIN DELETE FROM public.league_participants WHERE user_id IN (SELECT user_id FROM _users_to_delete); EXCEPTION WHEN undefined_table THEN RAISE NOTICE 'Skipping: league_participants'; END;
  BEGIN DELETE FROM public.tournament_participants WHERE user_id IN (SELECT user_id FROM _users_to_delete); EXCEPTION WHEN undefined_table THEN RAISE NOTICE 'Skipping: tournament_participants'; END;
  BEGIN DELETE FROM public.match_history WHERE user_id IN (SELECT user_id FROM _users_to_delete) OR opponent_id IN (SELECT user_id FROM _users_to_delete); EXCEPTION WHEN undefined_table THEN RAISE NOTICE 'Skipping: match_history'; END;
  BEGIN DELETE FROM public.leaderboard_entries WHERE user_id IN (SELECT user_id FROM _users_to_delete); EXCEPTION WHEN undefined_table THEN RAISE NOTICE 'Skipping: leaderboard_entries'; END;
  BEGIN DELETE FROM public.xp_log WHERE user_id IN (SELECT user_id FROM _users_to_delete); EXCEPTION WHEN undefined_table THEN RAISE NOTICE 'Skipping: xp_log'; END;
  BEGIN DELETE FROM public.notifications_page_state WHERE user_id IN (SELECT user_id FROM _users_to_delete); EXCEPTION WHEN undefined_table THEN RAISE NOTICE 'Skipping: notifications_page_state'; END;
  BEGIN DELETE FROM public.user_devices WHERE user_id IN (SELECT user_id FROM _users_to_delete); EXCEPTION WHEN undefined_table THEN RAISE NOTICE 'Skipping: user_devices'; END;
  BEGIN DELETE FROM public.push_subscriptions WHERE user_id IN (SELECT user_id FROM _users_to_delete); EXCEPTION WHEN undefined_table THEN RAISE NOTICE 'Skipping: push_subscriptions'; END;
  BEGIN DELETE FROM public.email_preferences WHERE user_id IN (SELECT user_id FROM _users_to_delete); EXCEPTION WHEN undefined_table THEN RAISE NOTICE 'Skipping: email_preferences'; END;
  BEGIN DELETE FROM public.privacy_settings WHERE user_id IN (SELECT user_id FROM _users_to_delete); EXCEPTION WHEN undefined_table THEN RAISE NOTICE 'Skipping: privacy_settings'; END;
  BEGIN DELETE FROM public.notification_preferences WHERE user_id IN (SELECT user_id FROM _users_to_delete); EXCEPTION WHEN undefined_table THEN RAISE NOTICE 'Skipping: notification_preferences'; END;
  BEGIN DELETE FROM public.theme_preferences WHERE user_id IN (SELECT user_id FROM _users_to_delete); EXCEPTION WHEN undefined_table THEN RAISE NOTICE 'Skipping: theme_preferences'; END;
  BEGIN DELETE FROM public.language_settings WHERE user_id IN (SELECT user_id FROM _users_to_delete); EXCEPTION WHEN undefined_table THEN RAISE NOTICE 'Skipping: language_settings'; END;
  BEGIN DELETE FROM public.accessibility_settings WHERE user_id IN (SELECT user_id FROM _users_to_delete); EXCEPTION WHEN undefined_table THEN RAISE NOTICE 'Skipping: accessibility_settings'; END;
  BEGIN DELETE FROM public.organization_members WHERE user_id IN (SELECT user_id FROM _users_to_delete); EXCEPTION WHEN undefined_table THEN RAISE NOTICE 'Skipping: organization_members'; END;
  BEGIN DELETE FROM public.organization_files WHERE uploaded_by IN (SELECT user_id FROM _users_to_delete); EXCEPTION WHEN undefined_table THEN RAISE NOTICE 'Skipping: organization_files'; END;
  BEGIN DELETE FROM public.organization_messages WHERE sender_id IN (SELECT user_id FROM _users_to_delete); EXCEPTION WHEN undefined_table THEN RAISE NOTICE 'Skipping: organization_messages'; END;
  BEGIN DELETE FROM public.verification_requests WHERE user_id IN (SELECT user_id FROM _users_to_delete); EXCEPTION WHEN undefined_table THEN RAISE NOTICE 'Skipping: verification_requests'; END;
  BEGIN DELETE FROM public.identity_verifications WHERE user_id IN (SELECT user_id FROM _users_to_delete); EXCEPTION WHEN undefined_table THEN RAISE NOTICE 'Skipping: identity_verifications'; END;
  BEGIN DELETE FROM public.background_checks WHERE user_id IN (SELECT user_id FROM _users_to_delete); EXCEPTION WHEN undefined_table THEN RAISE NOTICE 'Skipping: background_checks'; END;
  BEGIN DELETE FROM public.compliance_records WHERE user_id IN (SELECT user_id FROM _users_to_delete); EXCEPTION WHEN undefined_table THEN RAISE NOTICE 'Skipping: compliance_records'; END;
  BEGIN DELETE FROM public.audit_log WHERE user_id IN (SELECT user_id FROM _users_to_delete); EXCEPTION WHEN undefined_table THEN RAISE NOTICE 'Skipping: audit_log'; END;
  BEGIN DELETE FROM public.data_export_requests WHERE user_id IN (SELECT user_id FROM _users_to_delete); EXCEPTION WHEN undefined_table THEN RAISE NOTICE 'Skipping: data_export_requests'; END;
  BEGIN DELETE FROM public.account_deletion_requests WHERE user_id IN (SELECT user_id FROM _users_to_delete); EXCEPTION WHEN undefined_table THEN RAISE NOTICE 'Skipping: account_deletion_requests'; END;
  BEGIN DELETE FROM public.appeals WHERE user_id IN (SELECT user_id FROM _users_to_delete) OR reviewed_by IN (SELECT user_id FROM _users_to_delete); EXCEPTION WHEN undefined_table THEN RAISE NOTICE 'Skipping: appeals'; END;
  BEGIN DELETE FROM public.disputes WHERE opened_by IN (SELECT user_id FROM _users_to_delete) OR resolved_by IN (SELECT user_id FROM _users_to_delete); EXCEPTION WHEN undefined_table THEN RAISE NOTICE 'Skipping: disputes'; END;
  BEGIN DELETE FROM public.escrow_transactions WHERE buyer_id IN (SELECT user_id FROM _users_to_delete) OR seller_id IN (SELECT user_id FROM _users_to_delete); EXCEPTION WHEN undefined_table THEN RAISE NOTICE 'Skipping: escrow_transactions'; END;
  BEGIN DELETE FROM public.refund_requests WHERE user_id IN (SELECT user_id FROM _users_to_delete) OR processed_by IN (SELECT user_id FROM _users_to_delete); EXCEPTION WHEN undefined_table THEN RAISE NOTICE 'Skipping: refund_requests'; END;
  BEGIN DELETE FROM public.chargebacks WHERE user_id IN (SELECT user_id FROM _users_to_delete); EXCEPTION WHEN undefined_table THEN RAISE NOTICE 'Skipping: chargebacks'; END;
  BEGIN DELETE FROM public.fraud_flags WHERE user_id IN (SELECT user_id FROM _users_to_delete) OR flagged_by IN (SELECT user_id FROM _users_to_delete); EXCEPTION WHEN undefined_table THEN RAISE NOTICE 'Skipping: fraud_flags'; END;
  BEGIN DELETE FROM public.trust_scores WHERE user_id IN (SELECT user_id FROM _users_to_delete); EXCEPTION WHEN undefined_table THEN RAISE NOTICE 'Skipping: trust_scores'; END;
  BEGIN DELETE FROM public.reputation_history WHERE user_id IN (SELECT user_id FROM _users_to_delete); EXCEPTION WHEN undefined_table THEN RAISE NOTICE 'Skipping: reputation_history'; END;
  BEGIN DELETE FROM public.reviews WHERE reviewer_id IN (SELECT user_id FROM _users_to_delete) OR reviewee_id IN (SELECT user_id FROM _users_to_delete); EXCEPTION WHEN undefined_table THEN RAISE NOTICE 'Skipping: reviews'; END;
  BEGIN DELETE FROM public.reports WHERE reporter_id IN (SELECT user_id FROM _users_to_delete) OR reported_id IN (SELECT user_id FROM _users_to_delete); EXCEPTION WHEN undefined_table THEN RAISE NOTICE 'Skipping: reports'; END;
  BEGIN DELETE FROM public.moderation_queue WHERE moderator_id IN (SELECT user_id FROM _users_to_delete) OR content_author_id IN (SELECT user_id FROM _users_to_delete); EXCEPTION WHEN undefined_table THEN RAISE NOTICE 'Skipping: moderation_queue'; END;
  BEGIN DELETE FROM public.banned_words_reports WHERE reported_by IN (SELECT user_id FROM _users_to_delete); EXCEPTION WHEN undefined_table THEN RAISE NOTICE 'Skipping: banned_words_reports'; END;
  BEGIN DELETE FROM public.content_flags WHERE flagged_by IN (SELECT user_id FROM _users_to_delete); EXCEPTION WHEN undefined_table THEN RAISE NOTICE 'Skipping: content_flags'; END;
  BEGIN DELETE FROM public.spam_detection_log WHERE user_id IN (SELECT user_id FROM _users_to_delete); EXCEPTION WHEN undefined_table THEN RAISE NOTICE 'Skipping: spam_detection_log'; END;
  BEGIN DELETE FROM public.automation_rules WHERE created_by IN (SELECT user_id FROM _users_to_delete); EXCEPTION WHEN undefined_table THEN RAISE NOTICE 'Skipping: automation_rules'; END;
  BEGIN DELETE FROM public.scheduled_posts WHERE user_id IN (SELECT user_id FROM _users_to_delete); EXCEPTION WHEN undefined_table THEN RAISE NOTICE 'Skipping: scheduled_posts'; END;
  BEGIN DELETE FROM public.drafts WHERE user_id IN (SELECT user_id FROM _users_to_delete); EXCEPTION WHEN undefined_table THEN RAISE NOTICE 'Skipping: drafts'; END;
  BEGIN DELETE FROM public.templates WHERE user_id IN (SELECT user_id FROM _users_to_delete); EXCEPTION WHEN undefined_table THEN RAISE NOTICE 'Skipping: templates'; END;
  BEGIN DELETE FROM public.custom_emojis WHERE created_by IN (SELECT user_id FROM _users_to_delete); EXCEPTION WHEN undefined_table THEN RAISE NOTICE 'Skipping: custom_emojis'; END;
  BEGIN DELETE FROM public.sticker_packs WHERE created_by IN (SELECT user_id FROM _users_to_delete); EXCEPTION WHEN undefined_table THEN RAISE NOTICE 'Skipping: sticker_packs'; END;
  BEGIN DELETE FROM public.sound_effects WHERE uploaded_by IN (SELECT user_id FROM _users_to_delete); EXCEPTION WHEN undefined_table THEN RAISE NOTICE 'Skipping: sound_effects'; END;
  BEGIN DELETE FROM public.media_library WHERE uploaded_by IN (SELECT user_id FROM _users_to_delete); EXCEPTION WHEN undefined_table THEN RAISE NOTICE 'Skipping: media_library'; END;
  BEGIN DELETE FROM public.playlists WHERE user_id IN (SELECT user_id FROM _users_to_delete); EXCEPTION WHEN undefined_table THEN RAISE NOTICE 'Skipping: playlists'; END;
  BEGIN DELETE FROM public.playlist_items WHERE added_by IN (SELECT user_id FROM _users_to_delete); EXCEPTION WHEN undefined_table THEN RAISE NOTICE 'Skipping: playlist_items'; END;
  BEGIN DELETE FROM public.listening_history WHERE user_id IN (SELECT user_id FROM _users_to_delete); EXCEPTION WHEN undefined_table THEN RAISE NOTICE 'Skipping: listening_history'; END;
  BEGIN DELETE FROM public.watch_history WHERE user_id IN (SELECT user_id FROM _users_to_delete); EXCEPTION WHEN undefined_table THEN RAISE NOTICE 'Skipping: watch_history'; END;
  BEGIN DELETE FROM public.recommendations WHERE user_id IN (SELECT user_id FROM _users_to_delete); EXCEPTION WHEN undefined_table THEN RAISE NOTICE 'Skipping: recommendations'; END;
  BEGIN DELETE FROM public.trending_scores WHERE user_id IN (SELECT user_id FROM _users_to_delete); EXCEPTION WHEN undefined_table THEN RAISE NOTICE 'Skipping: trending_scores'; END;
  BEGIN DELETE FROM public.visibility_scores WHERE user_id IN (SELECT user_id FROM _users_to_delete); EXCEPTION WHEN undefined_table THEN RAISE NOTICE 'Skipping: visibility_scores'; END;
  BEGIN DELETE FROM public.hot_scores WHERE user_id IN (SELECT user_id FROM _users_to_delete); EXCEPTION WHEN undefined_table THEN RAISE NOTICE 'Skipping: hot_scores'; END;
  BEGIN DELETE FROM public.momentum_scores WHERE user_id IN (SELECT user_id FROM _users_to_delete); EXCEPTION WHEN undefined_table THEN RAISE NOTICE 'Skipping: momentum_scores'; END;
  BEGIN DELETE FROM public.engagement_metrics WHERE user_id IN (SELECT user_id FROM _users_to_delete); EXCEPTION WHEN undefined_table THEN RAISE NOTICE 'Skipping: engagement_metrics'; END;
  BEGIN DELETE FROM public.analytics_events WHERE user_id IN (SELECT user_id FROM _users_to_delete); EXCEPTION WHEN undefined_table THEN RAISE NOTICE 'Skipping: analytics_events'; END;
  BEGIN DELETE FROM public.session_recordings WHERE user_id IN (SELECT user_id FROM _users_to_delete); EXCEPTION WHEN undefined_table THEN RAISE NOTICE 'Skipping: session_recordings'; END;
  BEGIN DELETE FROM public.error_logs WHERE user_id IN (SELECT user_id FROM _users_to_delete); EXCEPTION WHEN undefined_table THEN RAISE NOTICE 'Skipping: error_logs'; END;
  BEGIN DELETE FROM public.performance_metrics WHERE user_id IN (SELECT user_id FROM _users_to_delete); EXCEPTION WHEN undefined_table THEN RAISE NOTICE 'Skipping: performance_metrics'; END;
  BEGIN DELETE FROM public.feature_flags WHERE enabled_by IN (SELECT user_id FROM _users_to_delete); EXCEPTION WHEN undefined_table THEN RAISE NOTICE 'Skipping: feature_flags'; END;

  -- Step 3: Delete from user_profiles (the main profile table)
  DELETE FROM public.user_profiles WHERE id IN (SELECT user_id FROM _users_to_delete);

  -- Step 4: Delete from auth.users (the authentication table)
  -- This requires service role or elevated privileges
  DELETE FROM auth.users WHERE id IN (SELECT user_id FROM _users_to_delete);

  -- Step 5: Clean up
  DROP TABLE _users_to_delete;

  RAISE NOTICE 'Done! All fake/test accounts deleted.';
END $$;

-- ============================================================================
-- VERIFICATION: Run this after the deletion to confirm cleanup
-- SELECT COUNT(*) as remaining_fake_accounts FROM public.user_profiles
--   WHERE id IN ('1549e574-0b28-4bdc-b74b-cdb7f3e9acda', ...);
-- Should return 0
-- ============================================================================